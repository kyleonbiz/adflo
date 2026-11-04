import { describe, expect, it } from "vitest";
import { addDays, displayStatus, invoicesCsv, monthlyDrafts, nextNumber, parseDollars, summarize, validateInvoiceForm, type BillingInvoice } from "@/lib/control/billing";
import type { ClientRecord, Plan } from "@/lib/control/types";

const inv = (o: Partial<BillingInvoice>): BillingInvoice => ({ id: "i", number: "AF-0001", clientId: "c1", clientName: "Acme", description: "AdFlo standard · November 2026", amountCents: 9900, issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "sent", paidOn: null, method: "", note: "", ...o });
const client = (o: Partial<ClientRecord>): ClientRecord => ({ id: "c1", name: "Acme", status: "active", plan: "standard", seatsLimit: 3, ownerName: "", ownerEmail: "", notes: "", workspaceId: null, startedOn: null, createdAt: "", priceOverrideCents: null, priceNote: "", ...o } as ClientRecord);
const plans: Plan[] = [{ id: "p1", name: "standard", priceCents: 9900, seatsIncluded: 3, active: true }];

describe("money and dates", () => {
  it("parses dollars into cents and rejects junk", () => {
    expect(parseDollars("$1,200.50")).toBe(120050);
    expect(parseDollars("99")).toBe(9900);
    expect(parseDollars("1.5")).toBe(150);
    for (const bad of ["", "0", "-5", "1.234", "abc", "$", "1e3"]) expect(parseDollars(bad)).toBeNull();
  });
  it("adds days across a month end", () => expect(addDays("2026-11-20", 14)).toBe("2026-12-04"));
});

describe("statuses and numbers", () => {
  it("a sent invoice past due is overdue; due today is not", () => {
    expect(displayStatus(inv({}), "2026-11-16")).toBe("overdue");
    expect(displayStatus(inv({}), "2026-11-15")).toBe("sent");
    expect(displayStatus(inv({ status: "paid" }), "2026-12-30")).toBe("paid");
  });
  it("numbers continue from the highest and never reuse a voided one", () => {
    expect(nextNumber([])).toBe("AF-0001");
    expect(nextNumber([inv({ number: "AF-0007", status: "void" }), inv({ number: "AF-0003" })])).toBe("AF-0008");
  });
});

describe("summary", () => {
  it("totals outstanding, overdue, paid this month and drafts", () => {
    const list = [inv({ amountCents: 1000 }), inv({ amountCents: 2000, dueOn: "2026-11-01" }), inv({ status: "paid", amountCents: 500, paidOn: "2026-11-03" }), inv({ status: "paid", amountCents: 700, paidOn: "2026-10-30" }), inv({ status: "draft", amountCents: 300 }), inv({ status: "void", amountCents: 9999 })];
    expect(summarize(list, "2026-11-10")).toEqual({ outstandingCents: 3000, overdueCents: 2000, overdueCount: 1, paidThisMonthCents: 500, draftCents: 300 });
  });
});

describe("form validation", () => {
  const good = { clientId: "c1", description: "Setup", amount: "250", issuedOn: "2026-11-01", dueOn: "2026-11-15", note: "" };
  it("accepts a good form", () => expect(validateInvoiceForm(good, ["c1"])).toMatchObject({ ok: true, value: { amountCents: 25000 } }));
  it("flags each bad field", () => {
    const r = validateInvoiceForm({ ...good, clientId: "x", description: "a", amount: "0", dueOn: "2026-10-01" }, ["c1"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["amount", "clientId", "description", "dueOn"]);
  });
  it("rejects an impossible date", () => expect(validateInvoiceForm({ ...good, issuedOn: "2026-02-30" }, ["c1"]).ok).toBe(false));
});

describe("monthly drafts", () => {
  it("bills only active, priced clients, once per month, using the client's own price when set", () => {
    const clients = [client({}), client({ id: "c2", name: "Trial Co", status: "trial" }), client({ id: "c3", name: "Deal Co", priceOverrideCents: 4900 }), client({ id: "c4", name: "Odd Co", plan: "mystery" })];
    const drafts = monthlyDrafts(clients, plans, [], "2026-11-04");
    expect(drafts.map((d) => [d.clientName, d.amountCents, d.number])).toEqual([["Acme", 9900, "AF-0001"], ["Deal Co", 4900, "AF-0002"]]);
    expect(drafts[0].dueOn).toBe("2026-11-18");
    expect(monthlyDrafts(clients, plans, drafts, "2026-11-20")).toEqual([]); // already invoiced this month
    expect(monthlyDrafts(clients, plans, drafts.map((d) => ({ ...d, status: "void" as const })), "2026-11-20")).toHaveLength(2); // voided ones do not block
  });
});

describe("csv", () => {
  it("writes a header, a row per invoice, and keeps formulas as text", () => {
    const csv = invoicesCsv([inv({ clientName: "=cmd()", note: "a, b" })], "2026-11-10");
    expect(csv.split("\r\n")[0]).toBe("Number,Client,Description,Amount,Issued,Due,Status,Paid on,Method,Note");
    expect(csv).toContain("'=cmd()");
    expect(csv).toContain('"a, b"');
    expect(csv).toContain(",99.00,");
  });
});
