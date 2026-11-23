import { describe, expect, it } from "vitest";
import { buildDigest, digestEmail, digestSubject, isMonday, thresholdLicenses } from "@/lib/reminders/digest";
import type { License } from "@/lib/licenses/types";

const lic = (over: Partial<License>): License => ({
  id: "l1", name: "General liability", category: "insurance", issuer: "Acme Ins", number: "1", holder: "Me",
  issuedOn: "2026-01-01", expiresOn: "2026-12-31", renewalTermMonths: 12, reminderDays: [60, 30, 7], stage: "not_started",
  requiredDocuments: [], notes: "", verifiedOn: "2026-01-02", ...over,
});
const empty = { vendors: [], equipment: [] };

// 2026-11-23 is a Monday; 2026-11-24 is a Tuesday.
const MON = "2026-11-23", TUE = "2026-11-24";

describe("isMonday", () => {
  it("knows Mondays", () => {
    expect(isMonday(MON)).toBe(true);
    expect(isMonday(TUE)).toBe(false);
  });
});

describe("renewal digest", () => {
  it("sends nothing when nothing needs attention", () => {
    expect(buildDigest({ licenses: [lic({ expiresOn: "2027-06-30" })], ...empty }, MON)).toBeNull();
    expect(buildDigest({ licenses: [], ...empty }, MON)).toBeNull();
  });

  it("emails on a license's reminder day (30 days out) even on a Tuesday", () => {
    const d = buildDigest({ licenses: [lic({ expiresOn: "2026-12-24" })], ...empty }, TUE);
    expect(d?.reasons).toEqual(["threshold"]);
    expect(d?.items[0]).toMatchObject({ kind: "license", name: "General liability", severity: "warning" });
  });

  it("stays quiet on a Tuesday when no reminder day lands (even if something is expiring)", () => {
    // 20 days out is inside the 30-day window but is not one of 60/30/7.
    expect(buildDigest({ licenses: [lic({ expiresOn: "2026-12-14" })], ...empty }, TUE)).toBeNull();
  });

  it("sends the Monday roundup for overdue and due-soon items", () => {
    const d = buildDigest({ licenses: [lic({ expiresOn: "2026-11-10" }), lic({ id: "l2", name: "City permit", expiresOn: "2026-12-14" })], ...empty }, MON);
    expect(d?.reasons).toEqual(["weekly"]);
    expect(d?.items.map((i) => i.name)).toEqual(["General liability", "City permit"]);
    expect(d?.items[0].severity).toBe("critical");
  });

  it("combines both reasons on a Monday threshold day", () => {
    const d = buildDigest({ licenses: [lic({ expiresOn: "2026-12-23" })], ...empty }, MON);
    expect(d?.reasons).toEqual(["threshold", "weekly"]);
  });

  it("leaves a submitted renewal's reminder day alone", () => {
    expect(thresholdLicenses([lic({ expiresOn: "2026-12-24", stage: "submitted" })], TUE)).toEqual([]);
  });

  it("includes vendor documents and equipment dates, critical first", () => {
    const equipment = [{ id: "e1", name: "Van 2", type: "vehicle", identifier: "", location: "", assignedTo: "", status: "in_service",
      purchasedOn: null, warrantyEndsOn: null, nextServiceOn: "2026-11-01", nextInspectionOn: null }] as never;
    const d = buildDigest({ licenses: [lic({ expiresOn: "2026-12-14" })], vendors: [], equipment }, MON);
    expect(d?.items.map((i) => `${i.kind}:${i.name}`)).toEqual(["equipment:Van 2", "license:General liability"]);
  });
});

describe("digest email", () => {
  const d = buildDigest({ licenses: [lic({ expiresOn: "2026-11-10" })], ...empty }, MON)!;
  it("leads with what needs attention now", () => {
    expect(digestSubject(d)).toBe("1 item needs attention now");
  });
  it("names the team, lists items and links to the app, in text and HTML", () => {
    const e = digestEmail(d, { team: "Acme Roofing", appUrl: "https://www.adflo.pro/app" });
    expect(e.text).toContain("Acme Roofing");
    expect(e.text).toContain("License: General liability");
    expect(e.text).toContain("https://www.adflo.pro/app");
    expect(e.html).toContain("General liability");
  });
  it("escapes business names in the HTML and flattens line breaks in the text", () => {
    const e = digestEmail(d, { team: "A<b>\nBad", appUrl: "https://www.adflo.pro/app" });
    expect(e.html).not.toContain("<b>");
    expect(e.text.split("\n")[0]).toBe("Hi, this is your AdFlo summary for A<b> Bad.");
  });
  it("caps the list and says how many more there are", () => {
    const many = Array.from({ length: 20 }, (_, i) => lic({ id: `x${i}`, name: `Permit ${i}`, expiresOn: "2026-11-10" }));
    const e = digestEmail(buildDigest({ licenses: many, ...empty }, MON)!, { team: "T", appUrl: "https://www.adflo.pro/app" });
    expect(e.text).toContain("And 5 more items in AdFlo");
  });
});
