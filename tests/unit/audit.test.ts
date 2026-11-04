import { describe, expect, it } from "vitest";
import { MAX_ENTRIES, addEntry, describe as line, formatWhen, parseAudit, type AuditEntry } from "@/lib/audit/logic";

const entry = (n: number, over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: `a${n}`, by: "Kyle Fulwood Jr", verb: "created", what: `invoice INV-${n}`, area: "Invoices", href: "/app/invoices", at: "2026-11-04T16:12:00.000Z", ...over,
});

describe("audit log", () => {
  it("reads as who did what", () => {
    expect(line(entry(12))).toBe("Kyle Fulwood Jr created invoice INV-12");
  });

  it("puts the newest first and stays within its limit", () => {
    let list: AuditEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) list = addEntry(list, entry(i));
    expect(list).toHaveLength(MAX_ENTRIES);
    expect(list[0].id).toBe(`a${MAX_ENTRIES + 4}`);
  });

  it("formats the time for people, and tolerates a bad one", () => {
    expect(formatWhen("2026-11-04T16:12:00.000Z")).toMatch(/Nov 4, 2026/);
    expect(formatWhen("nonsense")).toBe("");
  });

  it("reads a saved log defensively", () => {
    expect(parseAudit("nope")).toEqual([]);
    expect(parseAudit(JSON.stringify({ not: "a list" }))).toEqual([]);
    const good = entry(1);
    const mixed = [good, { ...good, id: "b", area: "Elsewhere" }, { ...good, id: "c", href: "https://evil.example" }, { ...good, id: "d", at: "never" }, null, 7];
    expect(parseAudit(JSON.stringify(mixed))).toEqual([good]);
  });
});
