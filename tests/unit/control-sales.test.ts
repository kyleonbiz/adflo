import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL_CENTS, lastMonths, parseGoal, sampleSnapshots, snapshotFrom, summarizeSales, trendOf, type Snapshot } from "@/lib/control/sales";
import type { Invoice } from "@/lib/invoices/types";
import type { ClientRecord, Plan } from "@/lib/control/types";

const base: ClientRecord = {
  id: "c1", name: "Acme", status: "active", plan: "adflo", seatsLimit: 1, ownerName: "", ownerEmail: "a@acme.test", notes: "", workspaceId: null,
  startedOn: "2026-11-02", createdAt: "2026-11-01T10:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: null, lastActive: null, checklist: [],
};
const client = (o: Partial<ClientRecord>): ClientRecord => ({ ...base, ...o });
const plans: Plan[] = [
  { id: "p1", name: "adflo", priceCents: 9900, seatsIncluded: 1, active: true },
  { id: "p2", name: "custom", priceCents: 0, seatsIncluded: 25, active: true },
];
const TODAY = "2026-11-20";
const invoice = (o: Partial<Invoice>) => ({ id: "i", number: "INV-1", clientId: "c1", client: "Acme", items: [{ description: "x", qty: 1, rateCents: 5900 }], amountCents: 5900, issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "sent", paidOn: null, ...o }) as Invoice;

describe("summarizeSales", () => {
  it("counts recurring revenue from active clients only, with extra seats, and keeps trials as pipeline", () => {
    const s = summarizeSales([
      client({ id: "a" }),                                   // $99
      client({ id: "b", seatsLimit: 5 }),                    // $99 + 4 x $10 = $139
      client({ id: "c", priceOverrideCents: 4900 }),         // own price, all-in
      client({ id: "d", status: "trial", seatsLimit: 4 }),   // pipeline: $129 if it converts
      client({ id: "e", status: "cancelled" }),
      client({ id: "f", plan: "custom", seatsLimit: 40 }), // quoted, no price yet
    ], plans, null, TODAY);
    expect(s.mrrCents).toBe(9900 + 13900 + 4900);
    expect(s.activeClients).toBe(4);
    expect(s.pricedClients).toBe(3);
    expect(s.avgCents).toBe(Math.round(28700 / 3));
    expect(s.trialClients).toBe(1);
    expect(s.trialPotentialCents).toBe(12900);
    expect(s.extraSeatCents).toBe(4000);
    expect(s.seatsSold).toBe(1 + 5 + 1 + 40);
  });

  it("measures progress to the goal and how many clients are still needed", () => {
    const s = summarizeSales([client({ id: "a" }), client({ id: "b" })], plans, null, TODAY);
    expect(s.goalCents).toBe(DEFAULT_GOAL_CENTS);
    expect(s.goalPct).toBe(2);
    expect(s.remainingCents).toBe(1_000_000 - 19800);
    expect(s.clientsToGoal).toBe(Math.ceil((1_000_000 - 19800) / 9900));
    const done = summarizeSales([client({})], plans, null, TODAY, 5000);
    expect(done).toMatchObject({ goalPct: 100, remainingCents: 0, clientsToGoal: 0 });
  });

  it("has no clients-to-goal figure until somebody is paying", () => {
    const s = summarizeSales([client({ status: "trial" })], plans, null, TODAY);
    expect(s).toMatchObject({ mrrCents: 0, avgCents: 0, clientsToGoal: null, goalPct: 0 });
  });

  it("groups by plan, most revenue first", () => {
    const s = summarizeSales([client({ id: "a" }), client({ id: "b", status: "trial" }), client({ id: "c", plan: "custom" })], plans, null, TODAY);
    expect(s.byPlan).toEqual([
      { plan: "adflo", active: 1, trial: 1, mrrCents: 9900 },
      { plan: "custom", active: 1, trial: 0, mrrCents: 0 },
    ]);
  });

  it("counts clients added in each of the last six months", () => {
    const s = summarizeSales([
      client({ id: "a", startedOn: "2026-11-05" }),
      client({ id: "b", startedOn: null, createdAt: "2026-11-09T00:00:00Z" }),
      client({ id: "c", startedOn: "2026-08-30" }),
      client({ id: "d", startedOn: "2025-01-01" }),
    ], plans, null, TODAY);
    expect(s.months.map((m) => m.key)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(s.months.map((m) => m.added)).toEqual([0, 0, 1, 0, 0, 2]);
    expect(s.addedThisMonth).toBe(2);
  });

  it("reads money collected and still owed from the invoices, ignoring voided ones", () => {
    const s = summarizeSales([client({})], plans, [
      invoice({ id: "1", status: "paid", paidOn: "2026-11-10", amountCents: 5900 }),
      invoice({ id: "2", status: "paid", paidOn: "2026-10-30", amountCents: 7000 }),
      invoice({ id: "3", status: "sent", amountCents: 7900 }),
      invoice({ id: "4", status: "void", amountCents: 9999 }),
    ], TODAY);
    expect(s.collectedThisMonthCents).toBe(5900);
    expect(s.outstandingCents).toBe(7900);
    expect(summarizeSales([client({})], plans, null, TODAY)).toMatchObject({ collectedThisMonthCents: null, outstandingCents: null });
  });
});

describe("lastMonths and parseGoal", () => {
  it("rolls back across a year boundary", () => {
    expect(lastMonths("2026-02-10", 4).map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(lastMonths("2026-02-10", 1)[0].label).toBe("Feb 26");
  });
  it("reads a goal typed in dollars", () => {
    expect(parseGoal("10,000")).toBe(1_000_000);
    expect(parseGoal("$12500.50")).toBe(1_250_050);
    for (const bad of ["", "0", "-5", "abc", "99999999"]) expect(parseGoal(bad)).toBeNull();
  });
});

const snap = (day: string, mrrCents: number): Snapshot => ({ day, mrrCents, activeClients: 0, trialClients: 0, seatsSold: 0, extraSeatCents: 0, trialPotentialCents: 0 });

describe("revenue snapshots", () => {
  it("takes today's figures from the clients, keeping trials out of the revenue", () => {
    const s = snapshotFrom([client({ id: "a" }), client({ id: "b", seatsLimit: 5 }), client({ id: "c", status: "trial" })], plans, TODAY);
    // $99 with one seat, and $99 + 4 extra seats at $10; the trial would add $99 if it converted
    expect(s).toEqual({ day: TODAY, mrrCents: 9900 + 13900, activeClients: 2, trialClients: 1, seatsSold: 6, extraSeatCents: 4000, trialPotentialCents: 9900 });
  });
  it("has no trend until there are two days to compare", () => {
    expect(trendOf([])).toBeNull();
    expect(trendOf([snap("2026-11-20", 5900)])).toBeNull();
  });
  it("measures the change since the start and over the last 30 days", () => {
    const t = trendOf([snap("2026-09-01", 0), snap("2026-10-20", 5900), snap("2026-11-10", 11800), snap("2026-11-20", 17700)]);
    expect(t).toMatchObject({ changeCents: 17700, change30Cents: 11800 }); // 30 days before Nov 20 is Oct 21, so Oct 20 is the base
    expect(t?.first.day).toBe("2026-09-01");
  });
  it("has no 30-day figure when the history is shorter than 30 days", () => {
    expect(trendOf([snap("2026-11-10", 5900), snap("2026-11-20", 11800)])).toMatchObject({ changeCents: 5900, change30Cents: null });
  });
  it("shows a falling trend as a negative change", () => {
    expect(trendOf([snap("2026-11-01", 11800), snap("2026-11-20", 5900)])?.changeCents).toBe(-5900);
  });
  it("makes labelled sample history ending today, oldest first", () => {
    const s = sampleSnapshots(TODAY);
    expect(s).toHaveLength(9);
    expect(s[8].day).toBe(TODAY);
    expect(s.map((p) => p.day)).toEqual([...s.map((p) => p.day)].sort());
  });
});
