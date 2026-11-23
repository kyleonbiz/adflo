import { describe, expect, it } from "vitest";
import { clientDraft, fromLegacy, monthlyDrafts } from "@/lib/control/billing";
import type { Invoice } from "@/lib/invoices/types";
import { effectivePriceCents, extraSeats, type ClientRecord, type Plan } from "@/lib/control/types";

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

const seatPlans: Plan[] = [
  { id: "p2", name: "core +", priceCents: 5900, seatsIncluded: 3, active: true },
  { id: "p3", name: "enterprise", priceCents: 0, seatsIncluded: 25, active: true },
];

describe("per-seat billing", () => {
  it("charges $10 for each seat beyond the plan's included seats", () => {
    expect(extraSeats({ plan: "core +", priceOverrideCents: null, seatsLimit: 5 }, seatPlans)).toEqual({ count: 2, included: 3 });
    expect(effectivePriceCents({ plan: "core +", priceOverrideCents: null, seatsLimit: 3 }, seatPlans)).toBe(5900);
    expect(effectivePriceCents({ plan: "core +", priceOverrideCents: null, seatsLimit: 1 }, seatPlans)).toBe(5900);
    expect(effectivePriceCents({ plan: "core +", priceOverrideCents: null, seatsLimit: 5 }, seatPlans)).toBe(7900);
    expect(effectivePriceCents({ plan: "core +", priceOverrideCents: null, seatsLimit: 10 }, seatPlans)).toBe(12900);
  });
  it("treats a client's own price as all-in and does not bill seats on a plan with no set price", () => {
    expect(effectivePriceCents({ plan: "core +", priceOverrideCents: 4900, seatsLimit: 10 }, seatPlans)).toBe(4900);
    expect(extraSeats({ plan: "enterprise", priceOverrideCents: null, seatsLimit: 40 }, seatPlans).count).toBe(0);
    expect(effectivePriceCents({ plan: "enterprise", priceOverrideCents: null, seatsLimit: 40 }, seatPlans)).toBe(0);
    // A legacy plan keeps the price it was sold at, however many seats the client has.
    expect(effectivePriceCents({ plan: "standard", priceOverrideCents: null, seatsLimit: 8 }, plans)).toBe(9900);
    expect(extraSeats({ plan: "standard", priceOverrideCents: null, seatsLimit: 8 }, plans).count).toBe(0);
  });
  it("puts the extra seats on their own invoice line, totalled with the plan", () => {
    const [d] = monthlyDrafts([client({ plan: "core +", seatsLimit: 5 })], seatPlans, [], TODAY);
    expect(d.items).toEqual([
      { description: "AdFlo core + · November 2026", qty: 1, rateCents: 5900 },
      { description: "Extra seats beyond the 3 included ($10 each) · November 2026", qty: 2, rateCents: 1000 },
    ]);
    expect(d.amountCents).toBe(7900);
  });
  it("makes a single line when there are no extra seats, and nothing for an unpriced plan", () => {
    const [d] = monthlyDrafts([client({ plan: "core +", seatsLimit: 3 })], seatPlans, [], TODAY);
    expect(d.items).toHaveLength(1);
    expect(d.amountCents).toBe(5900);
    expect(monthlyDrafts([client({ plan: "enterprise", seatsLimit: 40 })], seatPlans, [], TODAY)).toHaveLength(0);
  });
  it("does not bill a client twice for the month once the seat line is on the invoice", () => {
    const [first] = monthlyDrafts([client({ plan: "core +", seatsLimit: 6 })], seatPlans, [], TODAY);
    expect(monthlyDrafts([client({ plan: "core +", seatsLimit: 6 })], seatPlans, [first], TODAY)).toHaveLength(0);
  });
  it("starts a manual invoice with the total and a note of the extra seats", () => {
    expect(clientDraft(client({ plan: "core +", seatsLimit: 4 }), seatPlans, TODAY)).toEqual({ client: "Acme", clientEmail: "pat@acme.test", description: "AdFlo core + · November 2026 + 1 extra seat", amount: "69.00" });
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
