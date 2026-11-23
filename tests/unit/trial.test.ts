import { describe, expect, it } from "vitest";
import { trialDaysLeft, trialPhase, type TrialInfo } from "@/lib/billing/trial";
import { trialStaffNotice, trialWelcomeEmail } from "@/lib/mail/trial-email";

const now = new Date("2026-11-24T12:00:00Z");
const base: TrialInfo = { clientId: "c1", company: "Acme", endsAt: "2026-11-27T12:00:00Z", paid: false, hasWorkspace: false };

describe("trial phase", () => {
  it("is a trial until the end time, then expired", () => {
    expect(trialPhase(base, now)).toBe("trial");
    expect(trialPhase({ ...base, endsAt: "2026-11-24T11:59:00Z" }, now)).toBe("expired");
    expect(trialPhase({ ...base, endsAt: null }, now)).toBe("expired");
  });
  it("paying wins over an ended trial, and a workspace wins over everything", () => {
    expect(trialPhase({ ...base, endsAt: "2026-11-20T00:00:00Z", paid: true }, now)).toBe("paid");
    expect(trialPhase({ ...base, paid: true, hasWorkspace: true }, now)).toBe("workspace");
  });
  it("counts whole days left, rounded up, never below zero", () => {
    expect(trialDaysLeft(base.endsAt, now)).toBe(3);
    expect(trialDaysLeft("2026-11-24T13:00:00Z", now)).toBe(1);
    expect(trialDaysLeft("2026-11-01T00:00:00Z", now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
  });
});

describe("trial emails", () => {
  it("welcomes the person with the end date, the app link and the $99 price", () => {
    const m = trialWelcomeEmail({ name: "Nina New", company: "Newco", endsOn: "November 27, 2026", appUrl: "https://www.adflo.pro/app/overview", days: 3 });
    expect(m.subject).toMatch(/free trial/i);
    expect(m.text).toContain("Hi Nina,");
    expect(m.text).toContain("November 27, 2026");
    expect(m.text).toContain("$99 a month");
    expect(m.html).toContain("https://www.adflo.pro/app/overview");
  });
  it("tells staff who started a trial, on one line each (no header injection)", () => {
    const m = trialStaffNotice({ name: "Nina\r\nBcc: x@y.z", email: "nina@newco.test", company: "Newco", endsOn: "November 27, 2026", controlUrl: "https://www.adflo.pro/control" });
    expect(m.subject).toBe("New AdFlo trial: Newco");
    expect(m.text).toContain("Email: nina@newco.test");
    expect(m.text).not.toMatch(/\r/);
    expect(m.text).toContain("Name: Nina Bcc: x@y.z");
  });
});
