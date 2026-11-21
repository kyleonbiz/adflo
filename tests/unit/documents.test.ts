import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { applyFormat } from "@/lib/documents/edit";
import { documentToHtml } from "@/lib/documents/html";
import { blocksToText, parseDocument, resolveBlocks } from "@/lib/documents/parse";
import { documentToPdf } from "@/lib/documents/pdf";
import { textToDocument } from "@/lib/documents/text";
import { formDocument } from "@/lib/documents/build";
import { layoutTemplate } from "@/lib/forms/layout";
import type { FormTemplate, Submission } from "@/lib/forms/types";

const lh = { name: "Acme Roofing", lines: ["1 Main St", "555-0100"] };
const pdfText = (d: Parameters<typeof documentToPdf>[0]) => new TextDecoder("latin1").decode(documentToPdf(d));

describe("document writing format", () => {
  it("reads headings, bold, lists, tables, rules, signature lines and page breaks", () => {
    const b = parseDocument("# Title\n\nSome **bold** and *italic* text\nsecond line\n\n- one\n- two\n\n1. first\n\n| A | B |\n| --- | --- |\n| x | {{Name}} |\n\n---\n[signatures: Sign | Date]\n[page break]");
    expect(b.map((x) => x.kind)).toEqual(["heading", "paragraph", "list", "list", "table", "rule", "signatures", "pagebreak"]);
    const para = b[1]!;
    expect(para.kind === "paragraph" && para.lines).toHaveLength(2); // line breaks are kept
    const tbl = b[4]!;
    expect(tbl.kind === "table" && tbl.header?.length === 2 && tbl.rows.length === 1).toBe(true);
    expect(b[6]).toEqual({ kind: "signatures", labels: ["Sign", "Date"] });
  });
  it("fills placeholders once as plain text, so an answer can never add formatting or more placeholders", () => {
    const blocks = resolveBlocks(parseDocument("Name: {{Name}}\n\n| A | B |\n| --- | --- |\n| x | {{Name}} |"), () => "**bold** | {{Other}} # x");
    const text = blocksToText(blocks);
    expect(text).toContain("Name: **bold** | {{Other}} # x");
    expect(JSON.stringify(blocks)).not.toContain('"bold":true');
    expect(blocks[1]!.kind === "table" && blocks[1].rows[0]!.length).toBe(2);
  });
  it("escapes everything in the HTML preview", () => {
    const html = documentToHtml({ title: "<b>T</b>", letterhead: { name: "<i>x</i>", lines: [] }, meta: [["<k>", "<v>"]], blocks: resolveBlocks(parseDocument("<script>alert(1)</script> **b**"), () => "") });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>T</b>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("form documents", () => {
  const form: FormTemplate = { id: "f", name: "Job report", description: "What was done today", sentCount: 0, documentTemplate: "",
    fields: [{ id: "a", label: "Crew lead", type: "text", required: true, options: [] }, { id: "b", label: "Work done", type: "longtext", required: false, options: [] }] };
  const sub: Submission = { id: "s", formId: "f", submittedBy: "Pat", submittedOn: "2026-11-19", values: { a: "Pat", b: "Replaced flashing" }, status: "new" };
  it("the default layout has a details table, a heading per long answer and signature lines", () => {
    const t = layoutTemplate(form.description, form.fields);
    expect(t).toContain("| Crew lead | {{Crew lead}} |");
    expect(t).toContain("### Work done");
    expect(t).toContain("[signatures: Signature | Date]");
  });
  it("fills a response under the letterhead, and a blank copy has fill-in lines", () => {
    expect(JSON.stringify(formDocument(form, sub, lh).blocks)).toContain("Replaced flashing");
    const blank = formDocument(form, null, lh);
    expect(JSON.stringify(blank.blocks)).toContain("______");
    expect(JSON.stringify(blank.blocks)).not.toContain("{{");
  });
});

const readBack = async (d: Parameters<typeof documentToPdf>[0]) => {
  const pdf = await getDocumentProxy(documentToPdf(d));
  const { text } = await extractText(pdf, { mergePages: true });
  return { text, pages: pdf.numPages };
};

describe("PDF", () => {
  const form: FormTemplate = { id: "f", name: "Job report", description: "", sentCount: 0, documentTemplate: "", fields: [{ id: "a", label: "Crew lead", type: "text", required: true, options: [] }] };
  const sub: Submission = { id: "s", formId: "f", submittedBy: "Pat", submittedOn: "2026-11-19", values: { a: "Pat" }, status: "new" };
  it("is a laid-out document: letterhead, title, details, outlined tables, signature labels and a page footer", async () => {
    const doc = formDocument(form, sub, lh);
    const { text } = await readBack(doc);
    for (const part of ["Acme Roofing", "1 Main St", "Job report", "SUBMITTED BY", "Nov 19, 2026", "Crew lead", "Pat", "Signature", "Page 1 of 1"]) expect(text).toContain(part);
    const raw = pdfText(doc);
    expect(raw).toContain(" re S"); // outlines around the panel and the table cells
    expect(raw).toContain("/Helvetica-Bold");
  });
  it("starts new pages for a long document and numbers every page", async () => {
    const rows = Array.from({ length: 80 }, (_, i) => `| Row ${i + 1} | value |`).join("\n");
    const { text, pages } = await readBack({ title: "Long", letterhead: lh, meta: [], blocks: resolveBlocks(parseDocument(`| A | B |\n| --- | --- |\n${rows}`), () => "") });
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain(`Page ${pages} of ${pages}`);
    expect(text).toContain("Row 80");
  });
  it("keeps typographic characters and brackets", async () => {
    const { text } = await readBack({ title: "Quote “x” (y)", letterhead: lh, meta: [], blocks: resolveBlocks(parseDocument("It’s a plan — (really)"), () => "") });
    expect(text).toContain("(y)");
    expect(text).toContain("It’s a plan");
  });
  it("wraps long paragraphs inside the page instead of running off it", async () => {
    const long = "word ".repeat(200).trim();
    const { text } = await readBack({ title: "Wrap", letterhead: lh, meta: [], blocks: resolveBlocks(parseDocument(long), () => "") });
    expect(text.match(/word/g)!.length).toBe(200);
  });
});

describe("plain text is given a structure", () => {
  it("makes a title, a details panel, headings, tables, lists and checklists", () => {
    const d = textToDocument("BUSINESS SUMMARY\nAs of 2026-11-19\n\n== Licenses ==\nExpiring soon: 3\nExpired: 1\n\nBy type\n  Contractor: 4\n  Business: 8\n\n- Renew one\n- Renew two\n\n[x] Fill out: W-9\n[ ] Collect: Insurance", lh);
    expect(d.title).toBe("Business Summary");
    expect(d.meta).toEqual([["As of", "2026-11-19"]]);
    expect(d.blocks.map((b) => b.kind)).toEqual(["heading", "table", "heading", "table", "list", "table"]);
  });
});

describe("template editor formatting", () => {
  it("wraps a selection in bold and prefixes lines for headings and lists, and toggles them off", () => {
    expect(applyFormat("make this bold", 5, 9, "bold").value).toBe("make **this** bold");
    expect(applyFormat("Intro", 0, 5, "h2").value).toBe("## Intro");
    expect(applyFormat("## Intro", 0, 8, "h2").value).toBe("Intro");
    expect(applyFormat("a\nb", 0, 3, "bullet").value).toBe("- a\n- b");
    expect(applyFormat("a\nb", 0, 3, "numbered").value).toBe("1. a\n2. b");
  });
  it("inserts blocks on their own lines and fields at the cursor", () => {
    expect(applyFormat("Before", 6, 6, "signatures").value).toBe("Before\n\n[signatures: Signature | Date]");
    expect(applyFormat("Name: ", 6, 6, { field: "Full name" }).value).toBe("Name: {{Full name}}");
    expect(applyFormat("", 0, 0, "table").value).toContain("| Item | Details |");
  });
});
