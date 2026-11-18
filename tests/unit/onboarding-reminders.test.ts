import { describe, expect, it } from "vitest";
import { cooldownHoursLeft, isReminderKind, nextReminder, reminderAgo, REMIND_COOLDOWN_HOURS } from "@/lib/control/reminders";
import { agreementEmail, agreementsEmail } from "@/lib/mail/onboarding-email";

const base = { ownerEmail: "pat@acme.com", workspaceId: "w1" as string | null, seatsUsed: 0 as number | null, agreementsWaiting: 0 };

describe("nextReminder", () => {
  it("reminds an owner who has not signed up yet", () => {
    expect(nextReminder(base)).toMatchObject({ kind: "signup", label: "Remind to sign up" });
  });
  it("reminds about a waiting agreement once the owner has joined", () => {
    expect(nextReminder({ ...base, seatsUsed: 2, agreementsWaiting: 1 })).toMatchObject({ kind: "agreement" });
  });
  it("puts signing up before accepting", () => {
    expect(nextReminder({ ...base, agreementsWaiting: 2 })?.kind).toBe("signup");
  });
  it("has nothing to say when there is no owner email, no workspace yet, or nothing outstanding", () => {
    expect(nextReminder({ ...base, ownerEmail: "  " })).toBeNull();
    expect(nextReminder({ ...base, ownerEmail: "not-an-email" })).toBeNull();
    expect(nextReminder({ ...base, workspaceId: null })).toBeNull();
    expect(nextReminder({ ...base, seatsUsed: 3 })).toBeNull();
  });
});

describe("reminder timing", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  it("blocks a second reminder inside the cooldown and rounds the wait up", () => {
    expect(cooldownHoursLeft("2026-11-18T09:30:00Z", now)).toBe(22);
    expect(cooldownHoursLeft("2026-11-17T12:00:00Z", now)).toBe(0);
    expect(cooldownHoursLeft(null, now)).toBe(0);
    expect(REMIND_COOLDOWN_HOURS).toBe(24);
  });
  it("says how long ago", () => {
    expect(reminderAgo("2026-11-18T08:00:00Z", now)).toBe("today");
    expect(reminderAgo("2026-11-17T08:00:00Z", now)).toBe("yesterday");
    expect(reminderAgo("2026-11-14T08:00:00Z", now)).toBe("4 days ago");
    expect(reminderAgo(null, now)).toBeNull();
  });
  it("accepts only the two reminder kinds", () => {
    expect(isReminderKind("signup") && isReminderKind("agreement")).toBe(true);
    expect(isReminderKind("welcome")).toBe(false);
  });
});

describe("reminder wording", () => {
  const items = [{ title: "Terms", link: "https://www.adflo.pro/agreement/a" }, { title: "Privacy", link: "https://www.adflo.pro/agreement/b" }];
  it("marks agreement emails as reminders only when asked", () => {
    expect(agreementEmail({ clientName: "A", ownerName: "P", link: "l", reminder: true }).subject).toBe("Reminder: Your AdFlo agreement");
    expect(agreementEmail({ clientName: "A", ownerName: "P", link: "l" }).subject).toBe("Your AdFlo agreement");
    expect(agreementsEmail({ clientName: "A", ownerName: "P", items, reminder: true }).subject).toBe("Reminder: Your AdFlo agreements");
    expect(agreementsEmail({ clientName: "A", ownerName: "P", items }).text).toContain("Welcome to AdFlo.");
    expect(agreementsEmail({ clientName: "A", ownerName: "P", items, reminder: true }).text).toContain("friendly reminder");
  });
});
