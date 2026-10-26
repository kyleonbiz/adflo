import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/import/csv";
import {
  aggregateLabel, columnStats, datasetToCsv, groupReport, nextSummaryDate, reportToCsv, rejectedToCsv, suggestColumns, summaryText, validateDataset, viewRecords,
} from "@/lib/datasets/logic";
import { inferColumnType, parseCell, parseDate, parseNumber } from "@/lib/datasets/parse";
import { SAMPLE_CSV, SAMPLE_NAME, sampleColumnRules } from "../support/datasets-sample-data";
import type { Dataset } from "@/lib/datasets/types";
import { columnLetter, datasetToXlsx, sheetName } from "@/lib/datasets/xlsx";
import { xlsxToCsv } from "@/lib/datasets/xlsx-read";

describe("parseNumber", () => {
  it.each([
    ["1200", 1200], ["1,200.50", 1200.5], ["$1,200.50", 1200.5], ["(150.25)", -150.25], ["-3", -3], ["+4.5", 4.5],
    ["12%", 12], [" 7 ", 7], ["$-5", -5], [".5", 0.5], ["0", 0],
  ])("parses %s", (text, n) => expect(parseNumber(text)).toBe(n));
  it.each(["", "abc", "n/a", "1.2.3", "1,2,3", "12 34", "$", "(", "1e5", "NaN", "Infinity", "1,00", "9".repeat(20)])("rejects %j", (text) =>
    expect(parseNumber(text)).toBeNull());
});

describe("parseDate", () => {
  it.each([["2026-03-14", "2026-03-14"], ["3/14/2026", "2026-03-14"], ["03-04-2026", "2026-03-04"], ["12/1/2026", "2026-12-01"]])("parses %s", (t, d) =>
    expect(parseDate(t)).toBe(d));
  it.each(["", "13/45/2026", "2/30/2026", "3/14/26", "2026/03/14", "March 3", "2026-3-4", "31/12/2026"])("rejects %j", (t) =>
    expect(parseDate(t)).toBeNull());
  it("accepts a leap day only in leap years", () => {
    expect(parseDate("2/29/2028")).toBe("2028-02-29");
    expect(parseDate("2/29/2027")).toBeNull();
  });
});

describe("inferColumnType", () => {
  it("picks date, number or text, tolerating up to 10% noise", () => {
    expect(inferColumnType(["1/2/2026", "2026-02-03", ""])).toBe("date");
    expect(inferColumnType(["$1,000", "250", "(5)", "n/a"])).toBe("text"); // 1 of 4 bad = 25%
    expect(inferColumnType([...Array(9).fill("10"), "n/a"])).toBe("number"); // exactly 10% bad
    expect(inferColumnType(["a", "b"])).toBe("text");
    expect(inferColumnType(["", " "])).toBe("text");
  });
});

describe("parseCell", () => {
  const col = (type: "text" | "number" | "date", required = false) => ({ name: "Col", type, required });
  it("handles blanks by the required flag", () => {
    expect(parseCell(col("text"), " ")).toEqual({ ok: true, value: null });
    expect(parseCell(col("text", true), " ")).toEqual({ ok: false, error: "Col is required" });
  });
  it("converts and explains failures", () => {
    expect(parseCell(col("number"), "$2,000")).toEqual({ ok: true, value: 2000 });
    expect(parseCell(col("number"), "n/a")).toEqual({ ok: false, error: 'Col: "n/a" is not a number' });
    expect(parseCell(col("date"), "3/4/2026")).toEqual({ ok: true, value: "2026-03-04" });
    expect(parseCell(col("date"), "soon")).toEqual({ ok: false, error: 'Col: "soon" is not a valid date' });
    expect(parseCell(col("text"), "  hi ")).toEqual({ ok: true, value: "hi" });
  });
});

function loadSample(dedupe = true) {
  const parsed = parseCsv(SAMPLE_CSV);
  const columns = sampleColumnRules(suggestColumns(parsed));
  const outcome = validateDataset(parsed, columns, dedupe);
  const dataset: Dataset = { name: SAMPLE_NAME, columns, rows: outcome.accepted.map((a) => a.value) };
  return { parsed, columns, outcome, dataset };
}

describe("the sample dataset", () => {
  it("guesses the types", () => {
    expect(loadSample().columns.map((c) => [c.name, c.type, c.required])).toEqual([
      ["Date", "date", false], ["Vendor", "text", true], ["Category", "text", false], ["Amount", "number", false], ["Notes", "text", false],
    ]);
  });
  it("accepts good rows, rejects bad ones by file line, and sets aside the repeated row", () => {
    const { outcome } = loadSample();
    expect(outcome.accepted).toHaveLength(8);
    expect(outcome.rejected).toEqual([
      { line: 6, errors: ["Vendor is required"] },
      { line: 9, errors: ['Amount: "n/a" is not a number'] },
    ]);
    expect(outcome.duplicates.map((d) => [d.line, d.of])).toEqual([[8, "file"]]);
  });
  it("keeps the repeated row when de-duplication is off", () => {
    expect(loadSample(false).outcome.accepted).toHaveLength(9);
  });
  it("normalizes values: dates to ISO, money to numbers", () => {
    const { dataset } = loadSample();
    expect(dataset.rows[0]).toEqual(["2026-07-03", "Acme Office Supply", "Supplies", 1240.5, "Printer paper"]);
    expect(dataset.rows[2][3]).toBe(-150.25);
    expect(dataset.rows[3][4]).toBeNull();
  });
});

describe("stats and reports", () => {
  const { dataset } = loadSample();
  it("computes column stats", () => {
    expect(columnStats(dataset, 3)).toMatchObject({ filled: 8, blank: 0, sum: 6907.64, min: -150.25, max: 2500, avg: 863.46 });
    expect(columnStats(dataset, 0)).toMatchObject({ min: "2026-07-03", max: "2026-09-27" });
    expect(columnStats(dataset, 1)).toMatchObject({ distinct: 4 });
    expect(columnStats(dataset, 4)).toMatchObject({ filled: 6, blank: 2, distinct: 5 });
    expect(columnStats({ ...dataset, rows: [] }, 3)).toEqual({ filled: 0, blank: 0, distinct: 0 });
  });
  it("totals by category, biggest first", () => {
    expect(groupReport(dataset, 2, 3, "sum").map((g) => [g.group, g.rows, g.value])).toEqual([
      ["Services", 2, 4300], ["Supplies", 3, 1646.49], ["Software", 1, 899], ["Shipping", 2, 62.15],
    ]);
  });
  it("averages and counts", () => {
    expect(groupReport(dataset, 2, 3, "avg")[0]).toEqual({ group: "Services", key: "Services", rows: 2, value: 2150 });
    expect(groupReport(dataset, 1, null, "count").map((g) => [g.group, g.value])).toEqual([
      ["Acme Office Supply", 3], ["Hooli Logistics", 2], ["Initech Staffing", 2], ["Globex Software", 1],
    ]);
  });
  it("groups dates by month and labels blanks", () => {
    expect(groupReport(dataset, 0, 3, "sum").map((g) => [g.group, g.value])).toEqual([
      ["July 2026", 1989.25], ["August 2026", 2810], ["September 2026", 2108.39],
    ]);
    expect(groupReport(dataset, 0, 3, "sum").map((g) => g.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    const withBlank: Dataset = { ...dataset, rows: [[null, "x", null, 5, null], ...dataset.rows] };
    expect(groupReport(withBlank, 2, 3, "sum").some((g) => g.group === "(blank)")).toBe(true);
  });
  it("counts the filled values of a measure, and puts blank dates last", () => {
    const rows: Dataset["rows"] = [[null, "x", "A", 5, null], ["2026-01-02", "x", "A", null, null], ["2026-01-09", "y", "B", 7, null]];
    const d: Dataset = { ...dataset, rows };
    expect(groupReport(d, 2, 3, "count").map((g) => [g.group, g.value])).toEqual([["A", 1], ["B", 1]]);
    expect(groupReport(d, 2, null, "count").map((g) => [g.group, g.value])).toEqual([["A", 2], ["B", 1]]);
    expect(groupReport(d, 0, 3, "sum").map((g) => g.group)).toEqual(["January 2026", "(blank)"]);
    expect(aggregateLabel(d, 3, "count")).toBe("Count of Amount");
    expect(reportToCsv(d, 2, 3, "count").split("\r\n")[0]).toBe("Category,Rows,Count of Amount");
  });
  it("finds min and max of a very large column without overflowing the stack", () => {
    const rows: Dataset["rows"] = Array.from({ length: 300_000 }, (_x, i) => [i]);
    const big: Dataset = { name: "big", columns: [{ name: "N", type: "number", required: false }], rows };
    expect(columnStats(big, 0)).toMatchObject({ min: 0, max: 299_999, filled: 300_000 });
  });
  it("exports the rejected rows with their problems for fixing", () => {
    const { parsed, outcome } = loadSample();
    const lines = rejectedToCsv(parsed, outcome.rejected).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Line,Problems,Date,Vendor,Category,Amount,Notes");
    expect(lines[1]).toBe("6,Vendor is required,08/09/2026,,Travel,420.75,Missing vendor");
    expect(lines).toHaveLength(3);
  });
  it("searches and sorts records", () => {
    expect(viewRecords(dataset, "globex", null)).toHaveLength(1);
    expect(viewRecords(dataset, "1,240", null)).toHaveLength(1); // as displayed
    expect(viewRecords(dataset, "zzz", null)).toEqual([]);
    expect(viewRecords(dataset, "", { column: 3, direction: "desc" }).map((r) => r[3]).slice(0, 2)).toEqual([2500, 1800]);
    const withBlank: Dataset = { ...dataset, rows: [[null, "x", null, null, null], ...dataset.rows] };
    expect(viewRecords(withBlank, "", { column: 3, direction: "asc" }).at(-1)![3]).toBeNull();
    expect(viewRecords(withBlank, "", { column: 3, direction: "desc" }).at(-1)![3]).toBeNull();
  });
  it("writes CSV for the data and the report", () => {
    const csv = datasetToCsv(dataset).trimEnd().split("\r\n");
    expect(csv[0]).toBe("Date,Vendor,Category,Amount,Notes");
    expect(csv[1]).toBe("2026-07-03,Acme Office Supply,Supplies,1240.5,Printer paper");
    expect(reportToCsv(dataset, 2, 3, "sum").split("\r\n").slice(0, 2)).toEqual(["Category,Rows,Total Amount", "Services,2,4300"]);
    expect(reportToCsv(dataset, 1, null, "count").split("\r\n")[0]).toBe("Vendor,Rows,Value");
  });
  it("neutralises formulas in exported text", () => {
    const evil: Dataset = { name: "x", columns: [{ name: "A", type: "text", required: false }], rows: [["=SUM(1)"]] };
    expect(datasetToCsv(evil)).toContain("'=SUM(1)");
  });
  it("describes the data in a text summary", () => {
    const text = summaryText(dataset, "2026-10-25");
    expect(text).toContain("DATA SUMMARY: Q3 expenses\nAs of Oct 25, 2026\n8 rows, 5 columns");
    expect(text).toContain("Amount (number): 8 filled, total 6,907.64, average 863.46, range -150.25 to 2,500");
    expect(text).toContain("Date (date): 8 filled, Jul 3, 2026 to Sep 27, 2026");
    expect(text).toContain("Notes (text): 6 filled, 2 blank, 5 distinct");
  });
});

describe("money formatting", () => {
  it("shows cents only when needed, or always when fixed", async () => {
    const { money, needsDecimals, displayCell } = await import("@/lib/datasets/logic");
    expect(money(1200)).toBe("1,200");
    expect(money(1200.5)).toBe("1,200.50");
    expect(money(1200, true)).toBe("1,200.00");
    expect(money(-0.1)).toBe("-0.10");
    expect(displayCell(899, "number", true)).toBe("899.00");
    expect(displayCell(null, "number", true)).toBe("");
    const { dataset } = loadSample();
    expect(needsDecimals(dataset, 3)).toBe(true);
    expect(needsDecimals(dataset, 1)).toBe(false);
    expect(needsDecimals({ ...dataset, rows: [[null, "a", "b", 5, null]] }, 3)).toBe(false);
  });
});

describe("nextSummaryDate", () => {
  it("is the coming Monday for weekly, whatever today is", () => {
    expect(nextSummaryDate("2026-10-25", "weekly")).toBe("2026-10-26"); // Sunday
    expect(nextSummaryDate("2026-10-26", "weekly")).toBe("2026-11-02"); // Monday -> the next one
    expect(nextSummaryDate("2026-10-30", "weekly")).toBe("2026-11-02"); // Friday
  });
  it("is the 1st of next month for monthly, across year ends", () => {
    expect(nextSummaryDate("2026-10-25", "monthly")).toBe("2026-11-01");
    expect(nextSummaryDate("2026-12-31", "monthly")).toBe("2027-01-01");
  });
});

describe("xlsx export", () => {
  const { dataset } = loadSample();
  const read = (d: Dataset) => {
    const files = unzipSync(datasetToXlsx(d));
    return { names: Object.keys(files).sort(), sheet: strFromU8(files["xl/worksheets/sheet1.xml"]), workbook: strFromU8(files["xl/workbook.xml"]) };
  };
  it("contains the parts of a minimal workbook", () => {
    expect(read(dataset).names).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
    expect(read(dataset).workbook).toContain('<sheet name="Q3 expenses" sheetId="1" r:id="rId1"/>');
  });
  it("writes numbers as numbers and text as inline strings, header first", () => {
    const { sheet } = read(dataset);
    expect(sheet).toContain('<row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve">Date</t></is></c>');
    expect(sheet).toContain('<c r="D2"><v>1240.5</v></c>');
    expect(sheet).toContain('<c r="D4"><v>-150.25</v></c>');
    expect(sheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">Acme Office Supply</t></is></c>');
    expect(sheet.match(/<row /g)).toHaveLength(9);
  });
  it("skips blank cells and keeps column letters right", () => {
    const { sheet } = read(dataset);
    expect(sheet).not.toContain('r="E5"'); // the blank note on row 5
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(701)).toBe("ZZ");
    expect(columnLetter(702)).toBe("AAA");
  });
  it("escapes XML, drops illegal characters and never turns text into a formula", () => {
    const evil: Dataset = {
      name: "a[b]:c/d?*\\ and a very long sheet name over thirty one characters",
      columns: [{ name: 'Q"<&>', type: "text", required: false }],
      rows: [["=1+1"], ["x\u0000y\u0007z"], ["  padded  "]],
    };
    const { sheet, workbook } = read(evil);
    expect(sheet).toContain("Q&quot;&lt;&amp;&gt;");
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">=1+1</t></is></c>');
    expect(sheet).toContain(">xyz<");
    expect(sheet).toContain(">  padded  <");
    expect(sheet).not.toMatch(/<f>/);
    const name = /sheet name="([^"]*)"/.exec(workbook)![1];
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[[\]:*?/\\]/);
  });
  it("names sheets safely", () => {
    expect(sheetName("")).toBe("Data");
    expect(sheetName("[]:*?/\\")).toBe("Data");
    expect(sheetName("  Q3  report ")).toBe("Q3 report");
  });
});

describe("xlsx import", () => {
  it("round-trips an exported workbook through the reader", () => {
    const { dataset } = loadSample();
    const csv = xlsxToCsv(datasetToXlsx(dataset));
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["Date", "Vendor", "Category", "Amount", "Notes"]);
    expect(parsed.rows).toHaveLength(8);
    expect(parsed.rows[2]).toEqual(["2026-07-21", "Hooli Logistics", "Shipping", "-150.25", "Refund"]);
  });
  it("reads shared strings, date styles and serial dates", () => {
    const xml = (s: string) => strToU8(s);
    const bytes = zipSync({
      "xl/workbook.xml": xml('<workbook><sheets><sheet name="A" sheetId="1" r:id="rId9"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": xml('<Relationships><Relationship Id="rId9" Type="x" Target="worksheets/data.xml"/></Relationships>'),
      "xl/sharedStrings.xml": xml('<sst><si><t>Day</t></si><si><t>Net</t></si><si><r><t>Ac</t></r><r><t>me &amp; Co</t></r></si></sst>'),
      "xl/styles.xml": xml('<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
      "xl/worksheets/data.xml": xml('<worksheet><sheetData>'
        + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Who</t></is></c></row>'
        + '<row r="2"><c r="A2" s="1"><v>46082</v></c><c r="B2"><v>-150.5</v></c><c r="C2" t="s"><v>2</v></c></row>'
        + '<row r="3"><c r="B3"><v>1E-3</v></c></row>'
        + '</sheetData></worksheet>'),
    });
    expect(xlsxToCsv(bytes)).toBe("Day,Net,Who\r\n2026-03-01,-150.5,Acme & Co\r\n,0.001,\r\n");
  });
  it("explains files that are not workbooks", () => {
    expect(() => xlsxToCsv(new Uint8Array([1, 2, 3]))).toThrow("not a valid Excel workbook");
    expect(() => xlsxToCsv(zipSync({ "xl/worksheets/sheet1.xml": strToU8("<worksheet><sheetData/></worksheet>") }))).toThrow("no data");
  });
});
