import { describe, expect, it } from "vitest";
import { CsvError, MAX_CELL_LENGTH, MAX_COLUMNS, MAX_ROWS, parseCsv } from "@/lib/import/csv";
import { mapRows, missingRequired, suggestMapping, type TargetField } from "@/lib/import/mapping";
import { runImport, type RowResult } from "@/lib/import/run";

describe("parseCsv", () => {
  it("parses a simple file and pads short rows", () => {
    const r = parseCsv("a,b,c\n1,2,3\n4,5\n");
    expect(r.headers).toEqual(["a", "b", "c"]);
    expect(r.rows).toEqual([["1", "2", "3"], ["4", "5", ""]]);
    expect(r.lines).toEqual([2, 3]);
    expect(r.delimiter).toBe(",");
  });
  it("handles CRLF, CR, a BOM and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4\r\n").rows).toEqual([["1", "2"], ["3", "4"]]);
    expect(parseCsv("a,b\r1,2\r3,4").rows).toEqual([["1", "2"], ["3", "4"]]);
  });
  it("supports quotes, escaped quotes, delimiters and newlines inside quotes, and tracks lines", () => {
    const r = parseCsv('name,note\n"Smith, Bob","said ""hi"""\n"Two\nlines",x\nlast,y');
    expect(r.rows).toEqual([["Smith, Bob", 'said "hi"'], ["Two\nlines", "x"], ["last", "y"]]);
    expect(r.lines).toEqual([2, 3, 5]);
  });
  it("detects semicolon and tab separators", () => {
    expect(parseCsv("a;b\n1;2").delimiter).toBe(";");
    expect(parseCsv("a\tb\n1\t2").rows).toEqual([["1", "2"]]);
    expect(parseCsv('"a,b",c;d\n1,2').delimiter).toBe(","); // the quoted comma is ignored; one comma outside, one semicolon
  });
  it("makes headers unique and names blank ones", () => {
    expect(parseCsv("name,name, ,Name\n1,2,3,4").headers).toEqual(["name", "name (2)", "Column 3", "Name (3)"]);
  });
  it("reports rows with more cells than headers but keeps them", () => {
    const r = parseCsv("a,b\n1,2,3\n4,5,\n");
    expect(r.extraCells).toEqual([{ line: 2 }]);
    expect(r.rows[0]).toEqual(["1", "2"]);
  });
  it("trims cells and strips control characters", () => {
    expect(parseCsv("a,b\n  x  ,y\u0000z\u0007\n").rows).toEqual([["x", "yz"]]);
  });
  it("rejects empty, header-only, unterminated and oversized input", () => {
    expect(() => parseCsv("   \n ")).toThrow(CsvError);
    expect(() => parseCsv("")).toThrow("empty");
    expect(parseCsv("a,b\n").rows).toEqual([]);
    expect(() => parseCsv('a,b\n1,"oops\n2,3')).toThrow(/starting on line 2 is never closed/);
    expect(() => parseCsv(`a\n${"x".repeat(MAX_CELL_LENGTH + 1)}`)).toThrow(/longer than/);
    expect(() => parseCsv(Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `c${i}`).join(","))).toThrow(/columns/);
    expect(() => parseCsv("a\n" + "x\n".repeat(MAX_ROWS + 2))).toThrow(/more than 5000 rows/);
    expect(parseCsv("a\n" + "x\n".repeat(MAX_ROWS)).rows).toHaveLength(MAX_ROWS);
  });
  it("keeps a final row that has no trailing newline and quoted empty values", () => {
    expect(parseCsv('a,b\n"",x').rows).toEqual([["", "x"]]);
    expect(parseCsv("a,b\n1,2").rows).toEqual([["1", "2"]]);
  });
});

const TARGETS: TargetField[] = [
  { key: "name", label: "Name", aliases: ["Full name", "Contact"], required: true },
  { key: "email", label: "Email", aliases: ["E-mail", "Email address"] },
  { key: "phone", label: "Phone", aliases: ["Mobile", "Telephone"] },
];

describe("suggestMapping", () => {
  it("matches exact names, labels and aliases ignoring case and punctuation", () => {
    expect(suggestMapping(["FULL NAME", "e-mail", "Tel"], TARGETS)).toEqual({ name: 0, email: 1, phone: null });
    expect(suggestMapping(["Phone", "Name", "Email"], TARGETS)).toEqual({ name: 1, email: 2, phone: 0 });
  });
  it("falls back to headers containing a longer alias, without reusing columns", () => {
    expect(suggestMapping(["Primary Email Address", "Contact Name", "Mobile Phone"], TARGETS)).toEqual({ name: 1, email: 0, phone: 2 });
    const m = suggestMapping(["Email address"], TARGETS);
    expect(Object.values(m).filter((v) => v === 0)).toHaveLength(1);
  });
  it("does not match short aliases by substring", () => {
    expect(suggestMapping(["Tel number"], [{ key: "t", label: "T", aliases: ["Tel"] }]).t).toBeNull();
  });
  it("reports unmapped required fields and maps rows", () => {
    const m = suggestMapping(["Email", "Phone"], TARGETS);
    expect(missingRequired(m, TARGETS).map((t) => t.key)).toEqual(["name"]);
    expect(mapRows([["a@b.co", "555"], ["c@d.co"]], m)).toEqual([
      { name: "", email: "a@b.co", phone: "555" },
      { name: "", email: "c@d.co", phone: "" },
    ]);
  });
});

describe("runImport", () => {
  const parse = (r: Record<string, string>): RowResult<{ name: string; email: string }> =>
    r.name ? { ok: true, value: { name: r.name, email: r.email.toLowerCase() } } : { ok: false, errors: ["Name is required"] };
  const keyOf = (v: { email: string }) => v.email;

  it("sorts rows into accepted, rejected and duplicates by line", () => {
    const records = [
      { name: "A", email: "a@x.co" }, { name: "", email: "b@x.co" }, { name: "A again", email: "A@x.co" },
      { name: "C", email: "c@x.co" }, { name: "D", email: "" }, { name: "E", email: "" },
    ];
    const out = runImport(records, [2, 3, 4, 5, 6, 7], parse, keyOf, new Set(["c@x.co"]));
    expect(out.accepted.map((a) => a.line)).toEqual([2, 6, 7]); // rows without a key are never duplicates
    expect(out.rejected).toEqual([{ line: 3, errors: ["Name is required"] }]);
    expect(out.duplicates.map((d) => [d.line, d.of])).toEqual([[4, "file"], [5, "existing"]]);
  });
  it("lets the first row win and never counts a rejected row as the original", () => {
    const out = runImport([{ name: "", email: "a@x.co" }, { name: "A", email: "a@x.co" }], [2, 3], parse, keyOf);
    expect(out.accepted).toHaveLength(1);
    expect(out.duplicates).toEqual([]);
  });
});
