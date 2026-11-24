import { describe, expect, it } from "vitest";
import { dueNudge, trialNudgeEmail, type TrialClient } from "@/lib/control/trial-nudge";

const NOW = new Date("2026-11-24T15:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const trial = (o: Partial<TrialClient> = {}): TrialClient => ({ selfServe: true, status: "trial", workspaceId: null, hasSubscription: false, endsAt: hours(20), endingSentAt: null, endedSentAt: null, ...o });

describe("dueNudge", () => {
  it("sends the ending email once the trial is within a day and a bit of ending, and not before", () => {
    expect(dueNudge(trial({ endsAt: hours(20) }), NOW)).toBe("ending");
    expect(dueNudge(trial({ endsAt: hours(30) }), NOW)).toBe("ending");
    expect(dueNudge(trial({ endsAt: hours(48) }), NOW)).toBeNull();
  });

  it("sends the ended email for a trial that ended in the last few days, then never", () => {
    expect(dueNudge(trial({ endsAt: hours(-2) }), NOW)).toBe("ended");
    expect(dueNudge(trial({ endsAt: hours(-90) }), NOW)).toBe("ended");
    expect(dueNudge(trial({ endsAt: hours(-120) }), NOW)).toBeNull();
  });

  it("sends each email only once", () => {
    expect(dueNudge(trial({ endingSentAt: hours(-1) }), NOW)).toBeNull();
    expect(dueNudge(trial({ endsAt: hours(-2), endedSentAt: hours(-1) }), NOW)).toBeNull();
    expect(dueNudge(trial({ endsAt: hours(-2), endingSentAt: hours(-20) }), NOW)).toBe("ended"); // the earlier one does not stop the later one
  });

  it("leaves out anyone who has paid, has a workspace, is not a self-serve trial, or has no end date", () => {
    for (const o of [{ hasSubscription: true }, { workspaceId: "w1" }, { selfServe: false }, { status: "active" }, { endsAt: null }, { endsAt: "nonsense" }]) expect(dueNudge(trial(o), NOW)).toBeNull();
  });
});

describe("trialNudgeEmail", () => {
  it("says what happens and links to the continue page, in one line per name", () => {
    const m = trialNudgeEmail("ending", { company: "Acme\r\nRoofing", ownerName: "Pat Lee", continueUrl: "https://www.adflo.pro/trial/continue" });
    expect(m.subject).toBe("Your AdFlo trial ends soon");
    expect(m.text).toContain("Hi Pat,");
    expect(m.text).toContain("https://www.adflo.pro/trial/continue");
    expect(m.text).not.toMatch(/\r/);
    expect(trialNudgeEmail("ended", { company: "Acme", ownerName: "", continueUrl: "https://x.test/c" }).subject).toBe("Your AdFlo trial has ended");
    expect(m.text).toContain("administrative management platform");
  });
});
