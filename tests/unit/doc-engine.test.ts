import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { starterForms } from "@/lib/forms/starter-forms";
import { blankFormDocument, formDocument, plainDocument } from "@/lib/forms/doc-model";
import { docToPdf } from "@/lib/forms/doc-pdf";
import { docToHtml } from "@/lib/forms/doc-html";
import { letterhead } from "@/lib/forms/doc-business";
import { textWidth, wrapText } from "@/lib/forms/doc-fonts";
import type { FormTemplate, Submission } from "@/lib/forms/types";

const biz = { name: "Ridgeline Builders", address: "412 Oak Street, Austin, TX 78701", phone: "(512) 555-0142", license: "TX-448812" };
const proposal = PAPERWORK.find((p) => p.form.id === "pw-proposal-contract")!.form;
const read = async (bytes: Uint8Array) => {
  const pdf = await getDocumentProxy(bytes);
  return { pages: pdf.numPages, text: (await extractText(pdf, { mergePages: true })).text };
};
const sub = (form: FormTemplate, values: Record<string, string>): Submission => ({ id: "s1", formId: form.id, submittedBy: "Dana Whitfield", submittedOn: "2026-11-20", values, status: "new" });
const idOf = (label: string) => proposal.fields.find((f) => f.label === label)!.id;

describe("form documents", () => {
  it("lays a filled proposal out like a printed contract: letterhead, fields, specifications, terms and signatures", async () => {
    const values = { [idOf("Recipient of proposal")]: "Alder Street Partners", [idOf("Job name")]: "Roof replacement", [idOf("Sum of")]: "18450", [idOf("We hereby provide specifications and estimates for")]: "Tear off and replace the roof.\nHaul away debris." };
    const { text, pages } = await read(docToPdf(formDocument(proposal, sub(proposal, values), biz)));
    expect(pages).toBe(1);
    for (const want of ["PROPOSAL AND CONTRACT", "RIDGELINE BUILDERS", "LIC. #TX-448812", "RECIPIENT OF PROPOSAL", "Alder Street Partners", "$18,450.00", "Haul away debris.", "AUTHORIZED SIGNATURE", "ACCEPTANCE SIGNATURE"]) expect(text).toContain(want);
    expect(text).not.toContain("?");
  });

  it("prints a blank copy with empty cells and no placeholders left in it", async () => {
    const { text } = await read(docToPdf(blankFormDocument(proposal, biz)));
    expect(text).toContain("JOB NAME");
    expect(text).not.toContain("{{");
    expect(text).not.toContain("Alder");
  });

  it("gives each kind of paperwork its own signature lines", () => {
    const lines = (id: string) => blankFormDocument(PAPERWORK.find((p) => p.form.id === id)!.form).blocks.flatMap((b) => (b.t === "cells" && b.sign ? b.cells.map((c) => c.label) : []));
    expect(lines("pw-time-off")).toEqual(["Requested by", "Date", "Approved by", "Date"]);
    expect(lines("pw-incident")).toContain("Reviewed by");
    expect(lines("pw-nda")).toEqual(["Signature", "Date"]);
    expect(lines("pw-temp-log")).toEqual([]);
  });

  it("builds a page for every built-in form, with every field on it", () => {
    for (const f of [...starterForms(), ...PAPERWORK.map((p) => p.form)]) {
      const html = docToHtml(blankFormDocument(f, biz));
      for (const field of f.fields) expect(html, `${f.name}: ${field.label}`).toContain(field.label.replace(/&/g, "&amp;"));
    }
  });

  it("shows exactly the form's fields, in the form's order, and nothing the form does not ask", () => {
    const labelsOf = (f: FormTemplate) => blankFormDocument(f).blocks.flatMap((b) => {
      if (b.t === "cells" && !b.sign) return b.cells.map((c) => c.label);
      if (b.t === "checks") return b.items.map((i) => i.label);
      if (b.t === "box") return [];
      return b.t === "heading" && !["Confirmations", "Checklist", "Acknowledgment", "Checks completed"].includes(b.text) ? [b.text] : [];
    });
    for (const f of [...starterForms(), ...PAPERWORK.map((p) => p.form)]) {
      const custom = f.documentTemplate.split("\n").some((l) => l.trim() && !/^[^{}]*:\s*(\{\{[^{}]+\}\})?$|^\{\{[^{}]+\}\}$|^-+$|^Signature:/.test(l.trim()) && l.trim() !== f.description);
      if (!custom) expect(labelsOf(f), f.name).toEqual(f.fields.map((x) => x.label));
    }
  });

  it("keeps hand-written wording as written", () => {
    const custom: FormTemplate = { id: "form-x", name: "Site note", description: "", sentCount: 0, fields: [{ id: "a", label: "Name", type: "text", required: true, options: [] }], documentTemplate: "Dear team,\nThis is a note from {{Name}} about the site." };
    const html = docToHtml(formDocument(custom, sub(custom, { a: "Dana" })));
    expect(html).toContain("This is a note from Dana about the site.");
  });

  it("runs onto more pages when the answers are long, with the title repeated and page numbers", async () => {
    const long = Array.from({ length: 140 }, (_, i) => `Scope item ${i + 1}: supply and install.`).join("\n");
    const { pages, text } = await read(docToPdf(formDocument(proposal, sub(proposal, { [idOf("We hereby provide specifications and estimates for")]: long }), biz)));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain("Scope item 140");
    expect(text).toContain(`Page 2 of ${pages}`);
  });
});

describe("plain text documents", () => {
  it("turns a report into a titled page with labelled rows", () => {
    const doc = plainDocument("INVOICES REPORT\nAs of 2026-11-21\n\n14 invoices\n\nOutstanding: $12,400.00\nPaid: $8,100.00\n\nBy status\n  Paid: 7\n  Sent: 4\n", biz);
    expect(doc.title).toBe("INVOICES REPORT");
    expect(doc.subtitle).toBe("As of 2026-11-21");
    expect(doc.blocks.map((b) => b.t)).toEqual(["para", "rows", "heading", "rows"]);
  });
  it("turns a packet into a checklist", () => {
    const doc = plainDocument("HIRE PACKET\nFor Sam\n\n[x] Fill out: W-4\n[ ] Collect: ID\n");
    expect(doc.blocks).toEqual([{ t: "checks", items: [{ label: "Fill out: W-4", checked: true }, { label: "Collect: ID", checked: false }] }]);
  });
});

describe("letterhead and text measuring", () => {
  it("uses the contractor license number and drops empty details", () => {
    expect(letterhead("Ridgeline", { address: " ", phone: "555" }, [{ name: "Local permit", number: "9" }, { name: "Contractor license", number: " TX-1 " }])).toEqual({ name: "Ridgeline", address: undefined, phone: "555", email: undefined, license: "TX-1" });
  });
  it("measures and wraps text to the width asked for", () => {
    expect(textWidth("Hello", "sans", 10)).toBeCloseTo(((722 + 556 + 222 + 222 + 556) * 10) / 1000);
    const lines = wrapText("word ".repeat(80).trim(), "serif", 11, 200);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.every((l) => textWidth(l, "serif", 11) <= 200)).toBe(true);
    expect(wrapText("a\n\nb", "serif", 11, 200)).toEqual(["a", "", "b"]);
  });
});
