import { describe, expect, it } from "vitest";
import { arrangeInvoices } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";

const inv = (id: string, client: string, dueOn: string, amountCents: number): Invoice => ({
  id, number: `INV-${id}`, client, clientEmail: "", description: "", items: [], taxRate: 0, sender: { name: "", address: "", email: "", phone: "" } as Invoice["sender"],
  paymentMethods: [], amountCents, issuedOn: "2026-10-01", dueOn, status: "sent", paidOn: null, recurrence: "none", reminderDays: [], notes: "",
});
const list = [inv("2", "Beta", "2026-12-05", 100), inv("1", "Alpha", "2026-11-30", 500), inv("3", "Alpha", "2026-12-20", 300)];

describe("arrangeInvoices", () => {
  it("groups by client, alphabetical, and sorts inside by amount", () => {
    const g = arrangeInvoices(list, "2026-11-21", "client", "amount");
    expect(g.map((x) => x.label)).toEqual(["Alpha", "Beta"]);
    expect(g[0].invoices.map((i) => i.id)).toEqual(["1", "3"]);
  });
  it("groups by due month", () => {
    const g = arrangeInvoices(list, "2026-11-21", "month", null);
    expect(g.map((x) => x.label)).toEqual(["November 2026", "December 2026"]);
  });
  it("keeps the urgency groups by default", () => {
    expect(arrangeInvoices(list, "2026-11-21", "status", null).length).toBeGreaterThan(0);
  });
});
