import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, isDay } from "@/lib/dates";
import {
  expiredDependencies, expiryText, licenseAlerts, riskTier, licenseStatus, missingDocuments, needsReview, nextReminder, renewLicense, renewalTasks, suggestedExpiry, summarize,
} from "@/lib/licenses/logic";
import { sampleLicenses } from "../support/licenses-sample-data";
import type { License } from "@/lib/licenses/types";
import { licenseFormSchema } from "@/lib/licenses/validation";

const TODAY = "2026-10-25";

const lic = (over: Partial<License> = {}): License => ({
  id: "x", name: "Test license", category: "business", issuer: "", number: "", holder: "",
  issuedOn: "2026-01-01", expiresOn: "2027-01-01", renewalTermMonths: 12, reminderDays: [60, 30, 7],
  stage: "not_started", requiredDocuments: [], notes: "", verifiedOn: "2026-10-01", ...over,
});

describe("dates", () => {
  it("validates real calendar days only", () => {
    expect(isDay("2028-02-29")).toBe(true);
    expect(isDay("2027-02-29")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
    expect(isDay("10/25/2026")).toBe(false);
  });
  it("counts days across month and year ends", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-10-25", "2026-10-20")).toBe(-5);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("clamps month arithmetic to the end of the month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2027-12-31", 2)).toBe("2028-02-29");
    expect(addMonths("2026-03-15", -4)).toBe("2025-11-15");
  });
});

describe("licenseStatus", () => {
  it("moves from active to expired as the date approaches", () => {
    expect(licenseStatus(lic({ expiresOn: addDays(TODAY, 200) }), TODAY)).toBe("active");
    expect(licenseStatus(lic({ expiresOn: addDays(TODAY, 61) }), TODAY)).toBe("active");
    expect(licenseStatus(lic({ expiresOn: addDays(TODAY, 60) }), TODAY)).toBe("renewal_window");
    expect(licenseStatus(lic({ expiresOn: addDays(TODAY, 30) }), TODAY)).toBe("expiring");
    expect(licenseStatus(lic({ expiresOn: TODAY }), TODAY)).toBe("expiring");
    expect(licenseStatus(lic({ expiresOn: addDays(TODAY, -1) }), TODAY)).toBe("expired");
  });
});

describe("licenseAlerts", () => {
  it("has no alerts for a license far from expiry", () => {
    expect(licenseAlerts(lic({ expiresOn: addDays(TODAY, 300) }), TODAY)).toEqual([]);
  });
  it("escalates to critical in the last week and after expiry", () => {
    expect(licenseAlerts(lic({ expiresOn: addDays(TODAY, 5) }), TODAY)[0]).toMatchObject({ severity: "critical", message: "Expires in 5 days." });
    expect(licenseAlerts(lic({ expiresOn: addDays(TODAY, 1) }), TODAY)[0].message).toBe("Expires in 1 day.");
    expect(licenseAlerts(lic({ expiresOn: TODAY }), TODAY)[0].message).toBe("Expires today.");
    expect(licenseAlerts(lic({ expiresOn: addDays(TODAY, -3) }), TODAY)[0]).toMatchObject({ severity: "critical", message: "Expired 3 days ago. Renew immediately." });
  });
  it("flags missing documents only inside the renewal window", () => {
    const requiredDocuments = [{ id: "a", label: "A", received: false }, { id: "b", label: "B", received: true }];
    expect(licenseAlerts(lic({ requiredDocuments, expiresOn: addDays(TODAY, 300) }), TODAY)).toEqual([]);
    const near = licenseAlerts(lic({ requiredDocuments, expiresOn: addDays(TODAY, 45) }), TODAY);
    expect(near.map((a) => a.message)).toContain("1 required document still missing.");
    expect(near.find((a) => a.message.includes("missing"))?.severity).toBe("warning");
    const urgent = licenseAlerts(lic({ requiredDocuments, expiresOn: addDays(TODAY, 10) }), TODAY);
    expect(urgent.find((a) => a.message.includes("missing"))?.severity).toBe("critical");
  });
});

describe("submitted renewals", () => {
  const requiredDocuments = [{ id: "a", label: "A", received: false }];
  it("calms the alerts and stops nagging about documents", () => {
    const a = licenseAlerts(lic({ stage: "submitted", requiredDocuments, expiresOn: addDays(TODAY, 5) }), TODAY);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ severity: "info" });
    expect(a[0].message).toContain("waiting on the issuer");
  });
  it("downgrades an expired license to a warning while waiting", () => {
    const a = licenseAlerts(lic({ stage: "submitted", expiresOn: addDays(TODAY, -2) }), TODAY);
    expect(a[0].severity).toBe("warning");
  });
});

describe("review", () => {
  it("flags a license nobody has checked against its document", () => {
    const l = lic({ verifiedOn: undefined, expiresOn: addDays(TODAY, 300) });
    expect(needsReview(l)).toBe(true);
    expect(licenseAlerts(l, TODAY).map((x) => x.message)).toEqual(["Needs review. Check these details against the license."]);
    expect(needsReview(lic())).toBe(false);
  });
  it("does not let a review reminder raise the renewal task's urgency", () => {
    const l = lic({ id: "r", verifiedOn: undefined, expiresOn: addDays(TODAY, 50) });
    expect(renewalTasks([l], TODAY)[0].severity).toBe("info");
  });
});

describe("expiryText", () => {
  it("pluralizes", () => {
    expect(expiryText(-1)).toBe("1 day overdue");
    expect(expiryText(-3)).toBe("3 days overdue");
    expect(expiryText(0)).toBe("Expires today");
    expect(expiryText(1)).toBe("1 day left");
  });
});

describe("nextReminder", () => {
  it("returns the earliest reminder that has not fired yet", () => {
    const l = lic({ expiresOn: addDays(TODAY, 40), reminderDays: [60, 30, 7] });
    expect(nextReminder(l, TODAY)).toEqual({ on: addDays(TODAY, 10), daysBefore: 30 });
  });
  it("returns null once every reminder has passed", () => {
    expect(nextReminder(lic({ expiresOn: addDays(TODAY, 3), reminderDays: [60, 30, 7] }), TODAY)).toBeNull();
  });
  it("counts a reminder due today", () => {
    expect(nextReminder(lic({ expiresOn: addDays(TODAY, 30), reminderDays: [30] }), TODAY)?.on).toBe(TODAY);
  });
});

describe("renewalTasks", () => {
  it("creates tasks only for licenses in the window, most urgent first", () => {
    const tasks = renewalTasks(sampleLicenses(TODAY), TODAY);
    expect(tasks.map((t) => t.licenseId)).toEqual(["lic-2", "lic-1", "lic-3"]);
    expect(tasks[0]).toMatchObject({ title: "Renew City Operating Permit", severity: "critical", daysLeft: -6 });
  });
});

describe("renewLicense", () => {
  it("extends from the old expiry and resets the checklist", () => {
    const l = lic({
      expiresOn: addDays(TODAY, 10), renewalTermMonths: 12, stage: "submitted",
      requiredDocuments: [{ id: "a", label: "A", received: true }],
    });
    const r = renewLicense(l, TODAY);
    expect(r.expiresOn).toBe(addMonths(addDays(TODAY, 10), 12));
    expect(r.issuedOn).toBe(TODAY);
    expect(r.stage).toBe("not_started");
    expect(missingDocuments(r)).toBe(1);
  });
  it("extends from today when the license already lapsed", () => {
    expect(renewLicense(lic({ expiresOn: addDays(TODAY, -40), renewalTermMonths: 6 }), TODAY).expiresOn).toBe(addMonths(TODAY, 6));
  });
});

describe("renewLicense with the issuer's dates", () => {
  it("uses the granted expiry and number, and records history", () => {
    const l = lic({ expiresOn: addDays(TODAY, 10), number: "OLD" });
    const r = renewLicense(l, TODAY, { expiresOn: "2028-03-01", number: "NEW" });
    expect(r.expiresOn).toBe("2028-03-01");
    expect(r.number).toBe("NEW");
    expect(r.verifiedOn).toBe(TODAY);
    expect(r.renewals).toEqual([{ on: TODAY, previousExpiresOn: l.expiresOn, newExpiresOn: "2028-03-01" }]);
    expect(suggestedExpiry(l, TODAY)).toBe(addMonths(l.expiresOn, 12));
  });
});

describe("summarize", () => {
  it("counts every sample status", () => {
    expect(summarize(sampleLicenses(TODAY), TODAY)).toEqual({
      total: 5, active: 2, renewalWindow: 1, expiring: 1, expired: 1, missingDocuments: 5, needsReview: 5,
    });
  });
});

describe("licenseFormSchema", () => {
  const valid = {
    name: "Food Handler Permit", category: "permit", issuer: "Health Dept", number: "FH-1", holder: "",
    issuedOn: "2026-01-01", expiresOn: "2027-01-01", renewalTermMonths: "12", reminderDays: "60, 30, 7", notes: "", reviewed: true, documents: "Annual report\n\n  Fee receipt ",
  };
  it("parses reminder days and coerces the term", () => {
    const r = licenseFormSchema.parse(valid);
    expect(r.reminderDays).toEqual([60, 30, 7]);
    expect(r.renewalTermMonths).toBe(12);
    expect(r.documents).toEqual(["Annual report", "Fee receipt"]);
  });
  it("will not accept a license that was not reviewed", () => {
    const r = licenseFormSchema.safeParse({ ...valid, reviewed: false });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.success ? [] : r.error.issues)).toContain("checked these details");
  });
  it("explains bad reminder input plainly", () => {
    const r = licenseFormSchema.safeParse({ ...valid, reminderDays: "30, abc" });
    expect(JSON.stringify(r.success ? [] : r.error.issues)).toContain("whole numbers of days");
  });
  it.each([
    [{ expiresOn: "2025-12-31" }, "after the issue date"],
    [{ reminderDays: "" }, "at least one reminder"],
    [{ reminderDays: "30, abc" }, ""],
    [{ issuedOn: "2026-02-30" }, "valid date"],
    [{ name: "x" }, "Enter a name"],
  ])("rejects %j", (patch, text) => {
    const r = licenseFormSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    if (!r.success && text) expect(JSON.stringify(r.error.issues).toLowerCase()).toContain(text.toLowerCase());
  });
});

describe("risk tiers and dependencies", () => {
  const at = (days: number, over: Partial<License> = {}) => lic({ expiresOn: addDays(TODAY, days), ...over });

  it("is Safe past 60 days, Warning from 60 down to 30, Critical under 30 or expired", () => {
    expect(riskTier(at(61), TODAY)).toBe("safe");
    expect(riskTier(at(60), TODAY)).toBe("warning");
    expect(riskTier(at(30), TODAY)).toBe("warning");
    expect(riskTier(at(29), TODAY)).toBe("critical");
    expect(riskTier(at(-5), TODAY)).toBe("critical");
  });
  it("calms to Warning once a renewal is submitted", () => {
    expect(riskTier(at(10, { stage: "submitted" }), TODAY)).toBe("warning");
    expect(riskTier(at(-3, { stage: "submitted" }), TODAY)).toBe("warning");
    expect(riskTier(at(90, { stage: "submitted" }), TODAY)).toBe("safe");
  });
  it("makes a license Critical when a dependency has expired, whatever its own date", () => {
    const insurance = at(-1, { id: "coi", name: "Certificate of insurance" });
    const permit = at(400, { id: "permit", name: "Site permit", dependsOn: ["coi"] });
    expect(riskTier(permit, TODAY)).toBe("safe");
    expect(riskTier(permit, TODAY, [insurance, permit])).toBe("critical");
    expect(expiredDependencies(permit, [insurance, permit], TODAY).map((l) => l.id)).toEqual(["coi"]);
    const alert = licenseAlerts(permit, TODAY, [insurance, permit])[0];
    expect(alert).toMatchObject({ severity: "critical" });
    expect(alert.message).toContain("Certificate of insurance has expired");
  });
  it("overrides a submitted renewal when a dependency has expired", () => {
    const insurance = at(-1, { id: "coi" });
    const permit = at(5, { id: "permit", stage: "submitted", dependsOn: ["coi"] });
    expect(riskTier(permit, TODAY, [insurance, permit])).toBe("critical");
  });
  it("ignores dependencies that are valid, missing or itself", () => {
    const insurance = at(200, { id: "coi" });
    const permit = at(400, { id: "permit", dependsOn: ["coi", "gone", "permit"] });
    expect(riskTier(permit, TODAY, [insurance, permit])).toBe("safe");
  });
});

import { BUSINESS_TYPES, LICENSE_TEMPLATES, templatesFor } from "@/lib/licenses/templates";
import { compliance } from "@/lib/licenses/logic";
import { LICENSE_CATEGORIES as CATS } from "@/lib/licenses/types";
import { sampleLicenses as samples } from "../support/licenses-sample-data";

describe("license templates", () => {
  it("covers each business type, with unique ids and valid categories and terms", () => {
    expect(new Set(LICENSE_TEMPLATES.map((t) => t.id)).size).toBe(LICENSE_TEMPLATES.length);
    for (const b of BUSINESS_TYPES) expect(templatesFor(b.id).length).toBeGreaterThan(0);
    for (const t of LICENSE_TEMPLATES) {
      expect(CATS.map((c) => c.value)).toContain(t.category);
      expect(t.termMonths).toBeGreaterThanOrEqual(1);
      expect(t.reminderDays.length).toBeGreaterThan(0);
    }
  });

  it("includes car registration, tags and insurance for vehicles", () => {
    const names = templatesFor("vehicle").map((t) => t.name.toLowerCase()).join("|");
    expect(names).toContain("registration");
    expect(names).toContain("tags");
    expect(names).toContain("insurance");
  });
});

describe("compliance", () => {
  it("is 100% with nothing tracked and counts expired or missing-document items against you", () => {
    expect(compliance([], "2026-10-26").percent).toBe(100);
    const list = samples("2026-10-26");
    const c = compliance(list, "2026-10-26");
    expect(c.total).toBe(list.length);
    expect(c.inGoodStanding).toBeLessThanOrEqual(c.total);
    expect(c.percent).toBe(Math.round((c.inGoodStanding / c.total) * 100));
  });
});

import { licenseCalendarEvents } from "@/lib/licenses/logic";
import { toIcs } from "@/lib/ics";

describe("renewal calendar", () => {
  it("lists each expiry and its upcoming reminder days, leaving out reminders already past", () => {
    const today = "2026-10-26";
    const l = { ...sampleLicenses(today)[0], id: "x1", name: "City permit", expiresOn: "2026-11-20", reminderDays: [60, 30, 7] };
    const events = licenseCalendarEvents([l], today);
    // 60 and 30 days before 20 Nov are already past; only the 7-day reminder and the expiry remain.
    expect(events.map((e) => [e.day, e.summary])).toEqual([
      ["2026-11-13", "Renew City permit (7 days left)"],
      ["2026-11-20", "City permit expires"],
    ]);
    const ics = toIcs(events, today);
    expect(ics).toContain("SUMMARY:City permit expires");
    expect(ics).toContain("BEGIN:VEVENT");
  });
});

import { renewalSpend } from "@/lib/licenses/logic";

describe("renewal spend", () => {
  const today = "2026-10-26";
  const mk = (id: string, expiresOn: string, renewalCost?: number | null) => ({ ...sampleLicenses(today)[0], id, expiresOn, renewalCost });

  it("adds up fees for licenses due within 90 days, expired ones included, and counts those without a fee", () => {
    const list = [mk("a", "2026-11-10", 250), mk("b", "2026-10-01", 100), mk("c", "2026-12-01"), mk("d", "2027-06-01", 900)];
    expect(renewalSpend(list, today)).toEqual({ dollars: 350, count: 3, unknown: 1 });
    expect(renewalSpend([], today)).toEqual({ dollars: 0, count: 0, unknown: 0 });
  });

  it("reads the fee from the form as whole dollars or leaves it empty", () => {
    const base = { name: "Permit", category: "permit", issuer: "", number: "", holder: "", issuedOn: "2026-01-01", expiresOn: "2027-01-01", renewalTermMonths: "12", reminderDays: "30", notes: "", documents: "", reviewed: true };
    expect(licenseFormSchema.parse({ ...base, renewalCost: "250" }).renewalCost).toBe(250);
    expect(licenseFormSchema.parse(base).renewalCost).toBeNull();
    expect(licenseFormSchema.safeParse({ ...base, renewalCost: "12.50" }).success).toBe(false);
  });
});
