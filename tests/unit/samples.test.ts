import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/lib/dashboard/logic";
import { invoiceState } from "@/lib/invoices/logic";
import { licenseStatus } from "@/lib/licenses/logic";
import { SAMPLE_SETS } from "@/lib/samples/data";

const T = "2026-11-09";
const dateOk = (d: string | null | undefined) => d == null || /^\d{4}-\d{2}-\d{2}$/.test(d);

describe.each(SAMPLE_SETS)("sample set: $label", (set) => {
  const data = set.build(T);
  it("has records in every service with unique ids", () => {
    for (const list of Object.values(data) as { id: string }[][]) {
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    }
  });
  it("uses real calendar days and whole-cent amounts", () => {
    for (const i of data.invoices) {
      expect([i.issuedOn, i.dueOn, i.paidOn].every(dateOk)).toBe(true);
      expect(Number.isInteger(i.amountCents) && i.amountCents > 0).toBe(true);
    }
    for (const l of data.licenses) expect([l.issuedOn, l.expiresOn].every(dateOk)).toBe(true);
    for (const p of data.projects) for (const t of p.tasks) expect(dateOk(t.dueOn)).toBe(true);
  });
  it("shows late and upcoming work so the Dashboard has something to say", () => {
    const states = new Set(data.invoices.map((i) => invoiceState(i, T)));
    expect(states.has("overdue")).toBe(true);
    expect(data.licenses.some((l) => licenseStatus(l, T) === "expired")).toBe(true);
    expect(data.licenses.some((l) => licenseStatus(l, T) !== "expired")).toBe(true);
    const d = buildDashboard({ invoices: data.invoices, licenses: data.licenses, projects: data.projects, vendors: data.vendors }, T);
    expect(d.items.length).toBeGreaterThan(0);
    expect(d.status).not.toBe("clear");
  });
});

describe("sample sets differ in scale", () => {
  it("the large set is much bigger than the small one", () => {
    const [small, large] = [SAMPLE_SETS[0]!.build(T), SAMPLE_SETS[1]!.build(T)];
    expect(large.contacts.length).toBeGreaterThan(small.contacts.length * 8);
    expect(large.invoices.length).toBeGreaterThan(small.invoices.length * 5);
  });
});
