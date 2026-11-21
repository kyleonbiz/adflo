import { describe, expect, it } from "vitest";
import { dueLicenseFollowUps, licenseReminderEmail, logLicenseReminder } from "@/lib/licenses/follow-up";
import type { License } from "@/lib/licenses/types";

const lic = (over: Partial<License> = {}): License => ({
  id: "l1", name: "State contractor license", category: "professional", issuer: "State board", number: "C-123", holder: "Acme",
  issuedOn: "2025-01-01", expiresOn: "2026-12-01", renewalTermMonths: 12, reminderDays: [60, 30, 7], stage: "not_started",
  requiredDocuments: [{ id: "d1", label: "Fee receipt", received: false }], notes: "", ...over,
});

describe("license follow-ups", () => {
  it("chases licenses inside the window, skips active and submitted ones", () => {
    const today = "2026-11-21";
    const due = dueLicenseFollowUps([lic(), lic({ id: "a", expiresOn: "2028-01-01" }), lic({ id: "s", stage: "submitted" })], today);
    expect(due.map((d) => d.license.id)).toEqual(["l1"]);
  });
  it("waits a week after a reminder", () => {
    const l = logLicenseReminder(lic(), "2026-11-20");
    expect(dueLicenseFollowUps([l], "2026-11-21")).toHaveLength(0);
    expect(dueLicenseFollowUps([l], "2026-11-27")).toHaveLength(1);
  });
  it("words the email by state", () => {
    expect(licenseReminderEmail(lic(), "2026-11-21").body).toContain("Fee receipt");
    expect(licenseReminderEmail(lic({ expiresOn: "2026-11-01" }), "2026-11-21").subject).toMatch(/^Expired/);
  });
});
