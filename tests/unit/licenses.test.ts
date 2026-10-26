import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, isDay } from "@/lib/dates";
import {
  expiryText, licenseAlerts, licenseStatus, missingDocuments, needsReview, nextReminder, renewLicense, renewalTasks, suggestedExpiry, summarize,
} from "@/lib/licenses/logic";
import { sampleLicenses } from "@/lib/licenses/sample-data";
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
