import { describe, expect, it } from "vitest";
import { fromLegacy, monthlyDrafts } from "@/lib/control/billing";
import type { Invoice } from "@/lib/invoices/types";
import type { ClientRecord, Plan } from "@/lib/control/types";

const client = (o: Partial<ClientRecord>): ClientRecord => ({ id: "c1", name: "Acme", status: "active", plan: "standard", seatsLimit: 3, ownerName: "", ownerEmail: "pat@acme.test", notes: "", workspaceId: null, startedOn: null, createdAt: "", priceOverrideCents: null, priceNote: "", ...o } as ClientRecord);
const plans: Plan[] = [{ id: "p1", name: "standard", priceCents: 9900, seatsIncluded: 3, active: true }];
const TODAY = "2026-11-20";

describe("monthlyDrafts", () => {
  it("makes one full invoice per active client with a price, addressed to the owner", () => {
    const [d, ...rest] = monthlyDrafts([client({}), client({ id: "c2", status: "trial" }), client({ id: "c3", status: "suspended" })], plans, [], TODAY);
    expect(rest).toHaveLength(0);
    expect(d).toMatchObject({ clientId: "c1", client: "Acme", clientEmail: "pat@acme.test", amountCents: 9900, status: "draft", issuedOn: TODAY, dueOn: "2026-12-04" });
    expect(d.number).toMatch(/^INV-261120-\d{4}$/); // numbered exactly as the client app numbers invoices
    expect(d.items).toEqual([{ description: "AdFlo standard · November 2026", qty: 1, rateCents: 9900 }]);
    expect(d.sender.name).toBe("AdFlo");
  });
  it("skips a client who already has an invoice for the month, unless it was voided", () => {
    const [first] = monthlyDrafts([client({})], plans, [], TODAY);
    expect(monthlyDrafts([client({})], plans, [first], TODAY)).toHaveLength(0);
    expect(monthlyDrafts([client({})], plans, [{ ...first, status: "void" } as Invoice], TODAY)).toHaveLength(1);
  });
});

describe("invoices saved by the earlier screen", () => {
  it("become single-line invoices and junk is dropped", () => {
    const i = fromLegacy({ id: "x", number: "AF-0002", clientId: "c1", clientName: "Acme", description: "Setup", amountCents: 5000, issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "sent", paidOn: null, note: "hi" });
    expect(i).toMatchObject({ clientId: "c1", client: "Acme", amountCents: 5000, notes: "hi", status: "sent" });
    expect(i?.items).toHaveLength(1);
    expect(fromLegacy({ id: "x", amountCents: 0, status: "sent" })).toBeNull();
  });
});
