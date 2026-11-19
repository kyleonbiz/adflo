import { describe, expect, it } from "vitest";
import { daysBetween, isNewClient, onboardingRow, onboardingRows, summarizeOnboarding } from "@/lib/control/onboarding";
import { CHECKLIST_STEPS, type ClientRecord } from "@/lib/control/types";

const ALL = CHECKLIST_STEPS.map((s) => s.key);

const c = (o: Partial<ClientRecord>): ClientRecord => ({ id: "c1", name: "Acme", status: "active", plan: "standard", seatsLimit: 3, ownerName: "", ownerEmail: "", notes: "", workspaceId: null, startedOn: "2026-11-01", createdAt: "2026-11-01T00:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: null, lastActive: null, checklist: [], ...o } as ClientRecord);

describe("daysBetween", () => {
  it("counts whole days, never negative, and copes with timestamps and missing dates", () => {
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
    expect(daysBetween("2026-11-01T15:30:00Z", "2026-11-02")).toBe(1);
    expect(daysBetween("2026-12-01", "2026-11-01")).toBe(0);
    expect(daysBetween(null, "2026-11-01")).toBe(0);
    expect(daysBetween("not a date", "2026-11-01")).toBe(0);
  });
});

describe("onboardingRow", () => {
  it("reports progress and the first step still to do, in checklist order", () => {
    const r = onboardingRow(c({ checklist: ["details", "workspace", "agreement_sent"] }), "2026-11-04");
    expect([r.done, r.total, r.next, r.complete]).toEqual([3, 8, "Owner invited", false]);
  });
  it("is complete with every step done, and then can never be stalled", () => {
    const r = onboardingRow(c({ checklist: ALL }), "2026-12-30");
    expect([r.complete, r.next, r.stalled]).toEqual([true, null, false]);
  });
  it("is stalled once unfinished for a week, not before", () => {
    expect(onboardingRow(c({}), "2026-11-07").stalled).toBe(false);
    expect(onboardingRow(c({}), "2026-11-08").stalled).toBe(true);
  });
});

describe("onboardingRows", () => {
  it("leaves out suspended and cancelled clients", () => {
    const rows = onboardingRows([c({ id: "a", status: "suspended" }), c({ id: "b", status: "cancelled" }), c({ id: "t", status: "trial" }), c({ id: "x" })], "2026-11-04");
    expect(rows.map((r) => r.client.id).sort()).toEqual(["t", "x"]);
  });
  it("puts stalled first, then the least finished, with finished clients last", () => {
    const rows = onboardingRows([
      c({ id: "done", name: "Done Co", checklist: ALL }),
      c({ id: "new", name: "New Co", startedOn: "2026-11-03", checklist: [] }),
      c({ id: "half", name: "Half Co", startedOn: "2026-11-03", checklist: ["workspace", "owner_invited"] }),
      c({ id: "late", name: "Late Co", startedOn: "2026-10-01", checklist: ["workspace"] }),
    ], "2026-11-04");
    expect(rows.map((r) => r.client.id)).toEqual(["late", "new", "half", "done"]);
  });
  it("summarizes", () => {
    const rows = onboardingRows([c({ id: "a", startedOn: "2026-10-01" }), c({ id: "b", startedOn: "2026-11-03", checklist: ["workspace"] }), c({ id: "d", checklist: ALL })], "2026-11-04");
    expect(summarizeOnboarding(rows)).toEqual({ inProgress: 2, stalled: 1, complete: 1, notStarted: 1 });
  });
});

describe("new clients", () => {
  const today = "2026-11-19";
  it("is new until the owner signs in, however long that takes", () => {
    expect(isNewClient(c({ startedOn: "2026-11-18" }), today)).toBe(true);
    expect(isNewClient(c({ startedOn: "2026-06-01" }), today)).toBe(true);
  });
  it("stops being new once a member has joined, a sign-in is on record, or the step is ticked", () => {
    expect(isNewClient(c({ seatsUsed: 1 }), today)).toBe(false);
    expect(isNewClient(c({ lastActive: "2026-11-18T10:00:00Z" }), today)).toBe(false);
    expect(isNewClient(c({ checklist: ["first_login"] }), today)).toBe(false);
  });
  it("stays new after steps are done if nobody has signed in yet", () => {
    expect(isNewClient(c({ checklist: ["details", "workspace", "owner_invited", "welcome_sent"] }), today)).toBe(true);
  });
  it("is only for clients on trial or active", () => {
    expect(isNewClient(c({ status: "trial" }), today)).toBe(true);
    expect(isNewClient(c({ status: "suspended" }), today)).toBe(false);
    expect(isNewClient(c({ status: "cancelled" }), today)).toBe(false);
  });
});
