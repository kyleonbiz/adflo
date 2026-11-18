import { describe, expect, it } from "vitest";
import { recordsToCsv } from "@/lib/export/records-csv";

describe("recordsToCsv", () => {
  it("puts id first, unions the columns, and writes nested values as JSON", () => {
    const csv = recordsToCsv([
      { name: "Dana", id: "c1", tags: ["a", "b"] },
      { id: "c2", phone: "555", active: true, gone: null },
    ]);
    const [head, ...rows] = csv.trim().split("\r\n");
    expect(head).toBe("id,name,tags,phone,active,gone");
    expect(rows[0]).toBe('c1,Dana,"[""a"",""b""]",,,');
    expect(rows[1]).toBe("c2,,,555,true,");
  });
  it("keeps spreadsheet formulas as text", () => {
    expect(recordsToCsv([{ id: "1", name: "=SUM(A1)" }])).toContain("'=SUM(A1)");
  });
  it("gives just a header row for no records", () => {
    expect(recordsToCsv([])).toBe("\r\n");
  });
});
