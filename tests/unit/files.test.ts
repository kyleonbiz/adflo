// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryFromFolder, categoryFromName, misplacedCategory, suggestedFolder } from "@/lib/files/classify";
import { standardizeName, stripCopyMarker } from "@/lib/files/naming";
import { MAX_FILES, isSystemFile, normalizePath, parseFileList, shellQuote, splitName, splitPath } from "@/lib/files/paths";
import { buildPlan, findDuplicateGroups, layoutAfter } from "@/lib/files/plan";
import { sampleFiles } from "@/lib/files/sample-data";
import { moveScript, planToCsv, undoScript } from "@/lib/files/script";
import type { FileEntry, PlanOptions } from "@/lib/files/types";

const TODAY = "2026-10-25";
const ALL: PlanOptions = { rename: true, duplicates: true, misplaced: true, reorganize: false };
const file = (path: string, over: Partial<FileEntry> = {}): FileEntry => ({ path, size: 0, modified: null, ...over });

describe("paths", () => {
  it.each([
    ["a/b.txt", "a/b.txt"], ["./a//b.txt", "a/b.txt"], ["/a/b.txt", "a/b.txt"], ["a\\b\\c.txt", "a/b/c.txt"], ["  a/b/  ", "a/b"], ["....txt", "....txt"],
  ])("normalizes %j", (input, out) => expect(normalizePath(input)).toBe(out));
  it.each(["", "  ", "../a", "a/../b", "a/./b", "C:\\Users\\x", "c:/x", "a\nb", "a\u0000b", "a/\u0007", "/", "//"])("rejects %j", (input) =>
    expect(normalizePath(input)).toBeNull());
  it("splits paths and names", () => {
    expect(splitPath("a/b/c.txt")).toEqual({ dir: "a/b", name: "c.txt" });
    expect(splitPath("c.txt")).toEqual({ dir: "", name: "c.txt" });
    expect(splitName("report.final.PDF")).toEqual({ base: "report.final", ext: "PDF" });
    expect(splitName(".gitignore")).toEqual({ base: ".gitignore", ext: "" });
    expect(splitName("trailing.")).toEqual({ base: "trailing.", ext: "" });
    expect(splitName("notes.some long text")).toEqual({ base: "notes.some long text", ext: "" });
  });
  it("recognizes system litter", () => {
    for (const n of [".DS_Store", "Thumbs.db", "desktop.ini", "._resource"]) expect(isSystemFile(n)).toBe(true);
    for (const n of ["notes.txt", ".gitignore", "Thumbs.db.bak"]) expect(isSystemFile(n)).toBe(false);
  });
  it("quotes for the shell", () => {
    expect(shellQuote("a b")).toBe("'a b'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
    expect(shellQuote("$HOME `id`")).toBe("'$HOME `id`'");
  });
});

describe("parseFileList", () => {
  it("reads paths with optional size and date, skipping bad and repeated lines", () => {
    const r = parseFileList(["Docs/a.pdf | 1200 | 3/14/2026", "Docs\\b.txt", "", "../escape.txt", "Docs/a.pdf", "x.txt | big", "y.txt | 5 | someday", "ok/z.txt | 7"].join("\r\n"));
    expect(r.files).toEqual([
      { path: "Docs/a.pdf", size: 1200, modified: "2026-03-14" }, { path: "Docs/b.txt", size: 0, modified: null }, { path: "ok/z.txt", size: 7, modified: null },
    ]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["Not a usable path inside the folder", "Listed twice", '"big" is not a size in bytes', '"someday" is not a date']);
  });
  it("stops at the limit", () => {
    const r = parseFileList(Array.from({ length: MAX_FILES + 5 }, (_, i) => `f${i}.txt`).join("\n"));
    expect(r.files).toHaveLength(MAX_FILES);
    expect(r.truncated).toBe(true);
  });
});

describe("standardizeName", () => {
  it.each([
    ["Invoice_03-14-2026_Acme Corp.PDF", "Invoice 2026-03-14 Acme Corp.pdf"],
    ["scan_0034 .PDF", "scan 0034.pdf"],
    ["Meeting_Notes_10_05_2026.docx", "Meeting Notes 2026-10-05.docx"],
    ["Report..docx", "Report.docx"],
    ["  spaced   out   name .txt", "spaced out name.txt"],
    ["bad<>:\"|?*name.txt", "bad name.txt"],
    ["2026-03-14 already good.pdf", "2026-03-14 already good.pdf"],
    ["13-45-2026 not a date.txt", "13-45-2026 not a date.txt"],
    ["noext", "noext"],
    ["CON.txt", "CON file.txt"],
    [".pdf", ".pdf"],
    ["___.txt", "file.txt"],
  ])("%j -> %j", (input, out) => expect(standardizeName(input)).toBe(out));
  it("is idempotent and never leaves characters that break a path", () => {
    for (const n of ["A_b__c .PDF", "x:y*z?.Txt", "12.25.2026_report.XLSX", "CON", "a/b\\c.txt", "Ünïcode_name.PDF", "x".repeat(300) + ".txt"]) {
      const once = standardizeName(n);
      expect(standardizeName(once)).toBe(once);
      expect(once).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
      expect(once.length).toBeLessThanOrEqual(130);
    }
  });
});

describe("stripCopyMarker", () => {
  it.each([
    ["Report (1)", "Report", true], ["Report - Copy", "Report", true], ["Report copy", "Report", true], ["Report_copy", "Report", true],
    ["Report - Copy (2)", "Report", true], ["Report copy 3", "Report", true], ["Copy of Report", "Report", true],
    ["Report", "Report", false], ["Copyright notes", "Copyright notes", false], ["Report 2026 (final)", "Report 2026 (final)", false],
  ])("%j", (input, base, isCopy) => expect(stripCopyMarker(input)).toEqual({ base, isCopy }));
});

describe("classify", () => {
  it.each([
    ["Invoice_03.pdf", "invoices"], ["INV-1042.pdf", "invoices"], ["invoices_2026.xlsx", "invoices"], ["Receipt Staples.jpg", "receipts"],
    ["Lease Agreement.pdf", "contracts"], ["NDA signed.pdf", "contracts"], ["W-9_Initech.pdf", "tax"], ["w9.pdf", "tax"], ["2025 taxes.pdf", "tax"],
    ["resume_priya.docx", "hr"], ["Payroll May.xlsx", "hr"], ["notes.txt", null], ["Taxi receipt.pdf", "receipts"], ["Invoiced later.pdf", null], ["whatever.pdf", null],
  ])("name %j -> %j", (name, cat) => expect(categoryFromName(name)).toBe(cat));
  it.each([
    ["Invoices", "invoices"], ["01 Invoices", "invoices"], ["Docs/Receipts", "receipts"], ["Receipts/2026/Q1", "receipts"], ["Photos 2026", "images"], ["Tax", "tax"],
    ["Contracts", "contracts"], ["Human Resources", "hr"], ["Downloads", null], ["", null], ["Invoice Archive", null],
  ])("folder %j -> %j", (dir, cat) => expect(categoryFromFolder(dir)).toBe(cat));
  it("suggests folders by name, then type, then To Sort", () => {
    expect(suggestedFolder("Desktop/Invoice_1.pdf")).toBe("01 Invoices");
    expect(suggestedFolder("x/IMG_1.JPG")).toBe("06 Photos & Images");
    expect(suggestedFolder("x/data.csv")).toBe("07 Spreadsheets & Reports");
    expect(suggestedFolder("x/deck.pptx")).toBe("08 Presentations");
    expect(suggestedFolder("x/a.zip")).toBe("09 Archives");
    expect(suggestedFolder("x/mystery.bin")).toBe("00 To Sort");
    expect(suggestedFolder("x/receipt.jpg")).toBe("02 Receipts"); // a name beats a file type
  });
  it("calls a file misplaced only when its name and its folder clearly disagree", () => {
    expect(misplacedCategory("Invoices/contract_northwind.pdf")).toBe("contracts");
    expect(misplacedCategory("Invoices/Invoice_1.pdf")).toBeNull();
    expect(misplacedCategory("Downloads/contract.pdf")).toBeNull(); // the folder says nothing
    expect(misplacedCategory("Invoices/notes.pdf")).toBeNull(); // the name says nothing
    expect(misplacedCategory("Photos/receipt.jpg")).toBe("receipts");
  });
});

describe("findDuplicateGroups", () => {
  it("groups by identical contents, keeping the original over a copy and the older over the newer", () => {
    const g = findDuplicateGroups([
      file("a/Report (1).pdf", { size: 10, hash: "x", modified: "2026-01-01" }),
      file("b/Report.pdf", { size: 10, hash: "x", modified: "2026-05-01" }),
      file("c/other.pdf", { size: 10, hash: "y" }),
    ]);
    expect(g).toEqual([{ kind: "identical", keep: "b/Report.pdf", others: ["a/Report (1).pdf"] }]);
    const same = findDuplicateGroups([file("z/b.pdf", { size: 1, hash: "x", modified: "2026-05-01" }), file("a/b.pdf", { size: 1, hash: "x", modified: "2026-01-01" })]);
    expect(same[0].keep).toBe("a/b.pdf");
  });
  it("never treats different contents as duplicates, even with matching names", () => {
    expect(findDuplicateGroups([file("a/R.pdf", { size: 5, hash: "p" }), file("a/R (1).pdf", { size: 5, hash: "q" })])).toEqual([]);
  });
  it("falls back to size plus name apart from a copy marker when nothing was hashed", () => {
    const g = findDuplicateGroups([file("a/R.pdf", { size: 5 }), file("b/R - Copy.pdf", { size: 5 }), file("c/R.pdf", { size: 6 })]);
    expect(g).toEqual([{ kind: "likely", keep: "a/R.pdf", others: ["b/R - Copy.pdf"] }]);
  });
  it("without sizes, needs a copy marker beside its original", () => {
    expect(findDuplicateGroups([file("a/R.pdf"), file("a/R (1).pdf")])[0]).toMatchObject({ kind: "likely", keep: "a/R.pdf" });
    expect(findDuplicateGroups([file("a/R.pdf"), file("b/R.pdf")])).toEqual([]);
    expect(findDuplicateGroups([file("a/R.pdf"), file("b/R (1).pdf")])).toEqual([]);
  });
  it("ignores zero-size hashed files", () => {
    expect(findDuplicateGroups([file("a/e1.txt", { size: 0, hash: "e" }), file("a/e2.txt", { size: 0, hash: "e" })])).toEqual([]);
  });
});

describe("buildPlan on the sample folder", () => {
  const files = sampleFiles(TODAY);
  const plan = buildPlan(files, ALL);
  const change = (from: string) => plan.changes.find((c) => c.from === from);

  it("moves identical copies into a review folder that mirrors their location", () => {
    expect(change("Invoices/Invoice_03-14-2026_Acme (1).pdf")).toMatchObject({
      to: "_Duplicates (review)/Invoices/Invoice 2026-03-14 Acme (1).pdf",
      reasons: [{ kind: "rename" }, { kind: "duplicate", detail: "Identical to Invoices/Invoice_03-14-2026_Acme.pdf" }],
    });
    expect(change("Receipts/Receipt Staples - Copy.jpg")!.to).toBe("_Duplicates (review)/Receipts/Receipt Staples - Copy.jpg");
    expect(change("Downloads/W-9_Initech - Copy.pdf")!.reasons.map((r) => r.kind)).toEqual(["rename", "duplicate"]);
    expect(plan.duplicateGroups.map((g) => g.keep)).toEqual(["Downloads/W-9_Initech.pdf", "Invoices/Invoice_03-14-2026_Acme.pdf", "Receipts/receipt_staples.jpg"]);
  });
  it("renames to the house style", () => {
    expect(change("Desktop/scan_0034 .PDF")!.to).toBe("Desktop/scan 0034.pdf");
    expect(change("Misc/Meeting_Notes_10_05_2026.docx")!.to).toBe("Misc/Meeting Notes 2026-10-05.docx");
    expect(change("Invoices/Invoice_04-02-2026_Globex.pdf")!.to).toBe("Invoices/Invoice 2026-04-02 Globex.pdf");
  });
  it("moves a misplaced file to its folder", () => {
    expect(change("Invoices/contract_northwind_2026.pdf")).toMatchObject({
      to: "03 Contracts/contract northwind 2026.pdf",
      reasons: [{ kind: "rename" }, { kind: "misplaced", detail: 'Looks like a contract, but is in "Invoices"' }],
    });
  });
  it("leaves tidy files alone and never deletes or empties anything", () => {
    expect(change("Presentations/Sales deck.pptx")).toBeUndefined();
    expect(change("Invoices/Invoice_03-14-2026_Acme.pdf")!.to).toBe("Invoices/Invoice 2026-03-14 Acme.pdf");
    expect(plan.changes.every((c) => c.to !== "")).toBe(true);
  });
  it("keeps destinations unique and off every other file's current path", () => {
    const tos = plan.changes.map((c) => c.to.toLowerCase());
    expect(new Set(tos).size).toBe(tos.length);
    const currentPaths = new Set(files.map((f) => f.path.toLowerCase()));
    for (const c of plan.changes) if (c.to.toLowerCase() !== c.from.toLowerCase()) expect(currentPaths.has(c.to.toLowerCase())).toBe(false);
  });
  it("counts the space the duplicates take", () => {
    expect(plan.duplicateBytes).toBe(52_000 + 1_200_000 + 95_000);
  });
  it("honours the options", () => {
    expect(buildPlan(files, { ...ALL, rename: false }).changes.every((c) => c.reasons.every((r) => r.kind !== "rename"))).toBe(true);
    expect(buildPlan(files, { rename: false, duplicates: false, misplaced: false, reorganize: false }).changes).toEqual([]);
    const onlyDup = buildPlan(files, { rename: false, duplicates: true, misplaced: false, reorganize: false });
    expect(onlyDup.changes).toHaveLength(3);
  });
  it("can move everything into the suggested folders", () => {
    const re = buildPlan(files, { ...ALL, reorganize: true });
    expect(re.changes.find((c) => c.from === "Desktop/IMG_2231.JPG")!.to).toBe("06 Photos & Images/IMG 2231.jpg");
    expect(re.changes.find((c) => c.from === "Misc/resume_priya_shah.docx")!.to).toBe("05 HR/resume priya shah.docx");
    expect(re.changes.find((c) => c.from === "Downloads/setup_notes.txt")!.to).toBe("00 To Sort/setup notes.txt");
    expect(re.changes.find((c) => c.from === "Invoices/Invoice_03-14-2026_Acme (1).pdf")!.to.startsWith("_Duplicates (review)/")).toBe(true);
    const layout = layoutAfter(files, re.changes);
    expect(layout.find((l) => l.folder === "06 Photos & Images")!.count).toBe(2); // IMG_2231 and IMG_2232
    expect(layout.find((l) => l.folder === "02 Receipts")!.count).toBe(1); // the receipt photo goes by its name; its copy is set aside
    expect(layout.find((l) => l.folder === "_Duplicates (review)")!.count).toBe(3);
    expect(layout.reduce((n, l) => n + l.count, 0)).toBe(files.length);
  });
});

describe("buildPlan edge cases", () => {
  it("gives clashing names a number instead of overwriting", () => {
    const plan = buildPlan([file("a/Report_1.pdf"), file("a/Report 1.pdf")], { ...ALL, duplicates: false });
    expect(plan.changes).toEqual([{ from: "a/Report_1.pdf", to: "a/Report 1 (2).pdf", reasons: [{ kind: "rename", detail: "Report_1.pdf → Report 1.pdf" }] }]);
  });
  it("numbers several arrivals into the same folder in order", () => {
    const plan = buildPlan([file("In/contract_a.pdf"), file("Invoices/contract_a.pdf"), file("Invoices/x/contract_a.pdf")], { ...ALL, rename: false, duplicates: false });
    const tos = plan.changes.map((c) => c.to);
    expect(new Set(tos).size).toBe(tos.length);
  });
  it("treats a case-only rename as a rename and an unchanged name as no change", () => {
    expect(buildPlan([file("a/B.PDF")], ALL).changes[0]).toMatchObject({ from: "a/B.PDF", to: "a/B.pdf" });
    expect(buildPlan([file("a/b.pdf")], ALL).changes).toEqual([]);
  });
  it("skips paths that could escape or break a script", () => {
    const plan = buildPlan([file("../x.pdf"), file("a/b\nc.pdf"), file("ok/Fine_name.pdf")], ALL);
    expect(plan.skipped).toHaveLength(2);
    expect(plan.skipped[1].path).toBe("a/b?c.pdf");
    expect(plan.changes.map((c) => c.from)).toEqual(["ok/Fine_name.pdf"]);
  });
  it("handles an empty folder", () => {
    expect(buildPlan([], ALL)).toEqual({ changes: [], skipped: [], duplicateGroups: [], duplicateBytes: 0 });
  });
});

describe("scripts", () => {
  const changes = buildPlan(sampleFiles(TODAY), ALL).changes;
  it("write a CSV plan with formula protection", () => {
    const csv = planToCsv([{ from: "=evil.txt", to: "b/x, y.txt", reasons: [{ kind: "rename", detail: "r" }] }]).split("\r\n");
    expect(csv[0]).toBe("From,To,Why");
    expect(csv[1]).toBe("'=evil.txt,\"b/x, y.txt\",r");
  });
  it("only move, never delete or overwrite", () => {
    for (const script of [moveScript(changes), undoScript(changes)]) {
      expect(script.startsWith("#!/bin/sh\n")).toBe(true);
      expect(script).not.toMatch(/\brm\b|\brmdir\b|\bunlink\b|\bshred\b|\bdd\b|--force|mv -f/);
      expect(script).toContain("mv -n --");
      expect(script).toContain("cd \"$ROOT\" || exit 1");
    }
    expect(moveScript(changes).match(/^move '/gm)).toHaveLength(changes.length);
  });
  it("undo reverses the moves in the opposite order", () => {
    const undo = undoScript([{ from: "a", to: "b", reasons: [] }, { from: "c", to: "d", reasons: [] }]).split("\n").filter((l) => l.startsWith("move '"));
    expect(undo).toEqual(["move './d' './c'", "move './b' './a'"]);
  });
});

describe("running the generated scripts for real", () => {
  const nasty = [
    "Docs/plain file.pdf", "Docs/it's a trap.pdf", 'Docs/say "hi".pdf', "Docs/$HOME and `id`.pdf", "Docs/semi; colon & amp.pdf", "Docs/-rf dash.pdf",
    "Docs/Ünïcode naïve.PDF", "Docs/Invoice_03-14-2026_X.pdf", "Docs/Invoice_03-14-2026_X (1).pdf", "Docs/*.txt", "Docs/a b\\ c.pdf".replace("\\", ""),
    "Invoices/contract_ok.pdf",
  ];
  function setup() {
    const root = mkdtempSync(join(tmpdir(), "reset-"));
    const entries: FileEntry[] = nasty.map((p, i) => {
      const content = p.includes("(1)") || p.includes("Invoice_03-14-2026_X.pdf") ? "same-content" : `content ${i}`;
      mkdirSync(join(root, dirname(p)), { recursive: true });
      writeFileSync(join(root, p), content);
      const hash = content === "same-content" ? "H" : `h${i}`;
      return { path: p, size: content.length, modified: null, hash };
    });
    return { root, entries };
  }
  const tree = (root: string, rel = ""): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const name of readdirSync(join(root, rel))) {
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(join(root, r)).isDirectory()) Object.assign(out, tree(root, r));
      else out[r] = readFileSync(join(root, r), "utf8");
    }
    return out;
  };
  const run = (script: string, root: string, dir: string) => {
    const file = join(dir, "s.sh");
    writeFileSync(file, script);
    return execFileSync("sh", [file, root], { encoding: "utf8" });
  };

  it("moves awkward file names safely, loses no file and restores everything on undo", () => {
    const { root, entries } = setup();
    const scripts = mkdtempSync(join(tmpdir(), "scripts-"));
    try {
      const before = tree(root);
      const changes = buildPlan(entries, ALL).changes;
      expect(changes.length).toBeGreaterThan(5);
      const out = run(moveScript(changes), root, scripts);
      const after = tree(root);
      expect(out.match(/^Moved:/gm)).toHaveLength(changes.length);
      expect(Object.keys(after)).toHaveLength(Object.keys(before).length); // nothing lost, nothing overwritten
      expect(Object.values(after).sort()).toEqual(Object.values(before).sort()); // every file's contents survived
      expect(after["_Duplicates (review)/Docs/Invoice 2026-03-14 X (1).pdf"]).toBe("same-content");
      expect(after["03 Contracts/contract ok.pdf"]).toBeDefined();
      expect(existsSync(join(root, "Docs/it's a trap.pdf"))).toBe(true); // already tidy, so untouched

      const undoOut = run(undoScript(changes), root, scripts);
      expect(undoOut.match(/^Moved:/gm)).toHaveLength(changes.length);
      expect(tree(root)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(scripts, { recursive: true, force: true });
    }
  });
  it("skips instead of overwriting when something already sits at the destination", () => {
    const { root } = setup();
    const scripts = mkdtempSync(join(tmpdir(), "scripts-"));
    try {
      writeFileSync(join(root, "Docs/target.txt"), "keep me");
      writeFileSync(join(root, "Docs/source.txt"), "move me");
      const out = run(moveScript([{ from: "Docs/source.txt", to: "Docs/target.txt", reasons: [] }, { from: "Docs/missing.txt", to: "Docs/else.txt", reasons: [] }]), root, scripts);
      expect(out).toContain("Skipped (already exists): ./Docs/target.txt");
      expect(out).toContain("Skipped (not found): ./Docs/missing.txt");
      expect(readFileSync(join(root, "Docs/target.txt"), "utf8")).toBe("keep me");
      expect(readFileSync(join(root, "Docs/source.txt"), "utf8")).toBe("move me");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(scripts, { recursive: true, force: true });
    }
  });
});
