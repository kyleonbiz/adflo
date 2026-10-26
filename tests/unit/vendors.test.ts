import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  approvalBlockers, decide, defaultRequirements, docState, duplicatePairs, editDistance, findDuplicates,
  needsAttention, normalizeName, onboardingProgress, reopen, setActive, submitForApproval, summarize,
  vendorAlerts, vendorsToCsv,
} from "@/lib/vendors/logic";
import { sampleVendors } from "@/lib/vendors/sample-data";
import type { Vendor, VendorDocument } from "@/lib/vendors/types";
import { documentFormSchema, vendorFormSchema } from "@/lib/vendors/validation";

const TODAY = "2026-10-25";
const all = sampleVendors(TODAY);
const byId = (id: string) => all.find((v) => v.id === id)!;

const doc = (over: Partial<VendorDocument> = {}): VendorDocument => ({ id: "d", type: "W-9", required: true, receivedOn: null, expiresOn: null, ...over });
const vendor = (over: Partial<Vendor> = {}): Vendor => ({
  id: "x", name: "Test Co", category: "Supplies", contactName: "", email: "a@test.example", phone: "", taxId: "", notes: "",
  status: "onboarding", createdOn: TODAY, documents: [], decidedBy: null, decidedOn: null, comment: "", ...over,
});

describe("docState", () => {
  it("is missing until received, then valid, expiring or expired", () => {
    expect(docState(doc(), TODAY)).toBe("missing");
    expect(docState(doc({ receivedOn: "2026-01-01" }), TODAY)).toBe("valid");
    expect(docState(doc({ receivedOn: "2026-01-01", expiresOn: addDays(TODAY, 31) }), TODAY)).toBe("valid");
    expect(docState(doc({ receivedOn: "2026-01-01", expiresOn: addDays(TODAY, 30) }), TODAY)).toBe("expiring");
    expect(docState(doc({ receivedOn: "2026-01-01", expiresOn: TODAY }), TODAY)).toBe("expiring");
    expect(docState(doc({ receivedOn: "2026-01-01", expiresOn: addDays(TODAY, -1) }), TODAY)).toBe("expired");
  });
});

describe("requirements and progress", () => {
  it("every category needs a W-9 and insurance; others add more", () => {
    expect(defaultRequirements("Supplies").map((r) => r.type)).toEqual(["W-9", "Certificate of insurance"]);
    expect(defaultRequirements("Software")).toHaveLength(4);
    expect(defaultRequirements("Logistics").map((r) => r.type)).toContain("Carrier permit");
  });
  it("counts only received, unexpired required documents", () => {
    expect(onboardingProgress(byId("v-2"), TODAY)).toEqual({ done: 2, total: 3 }); // insurance expired
    expect(onboardingProgress(byId("v-3"), TODAY)).toEqual({ done: 2, total: 4 });
    expect(onboardingProgress(vendor(), TODAY)).toEqual({ done: 0, total: 0 });
  });
});

describe("approval flow", () => {
  it("lists blockers, and refuses to submit until they are cleared", () => {
    expect(approvalBlockers(byId("v-3"), TODAY)).toEqual(["W-9 is missing", "Certificate of insurance is missing"]);
    expect(approvalBlockers(byId("v-2"), TODAY)).toEqual(["Certificate of insurance has expired"]);
    const v = byId("v-3");
    expect(submitForApproval(v, TODAY)).toBe(v);
  });
  it("submits a complete onboarding vendor, then approves once", () => {
    const ready = vendor({ documents: [doc({ receivedOn: "2026-10-01" })] });
    const pending = submitForApproval(ready, TODAY);
    expect(pending.status).toBe("pending_approval");
    const approved = decide(pending, "approved", "Boss", TODAY, " ok ");
    expect(approved).toMatchObject({ status: "approved", decidedBy: "Boss", decidedOn: TODAY, comment: "ok" });
    expect(decide(approved, "rejected", "Other", TODAY)).toBe(approved);
    expect(decide(ready, "approved", "Boss", TODAY)).toBe(ready);
  });
  it("only submits from onboarding", () => {
    const v = vendor({ status: "approved" });
    expect(submitForApproval(v, TODAY)).toBe(v);
  });
  it("a rejected vendor can reopen, an approved one can be switched off and on", () => {
    expect(reopen(vendor({ status: "rejected" })).status).toBe("onboarding");
    expect(reopen(vendor({ status: "approved" })).status).toBe("approved");
    expect(setActive(vendor({ status: "approved" }), false).status).toBe("inactive");
    expect(setActive(vendor({ status: "inactive" }), true).status).toBe("approved");
    expect(setActive(vendor({ status: "onboarding" }), false).status).toBe("onboarding");
  });
});

describe("vendorAlerts", () => {
  it("is critical for an expired required document and warns before expiry", () => {
    expect(vendorAlerts(byId("v-2"), TODAY)[0]).toMatchObject({ severity: "critical" });
    expect(vendorAlerts(byId("v-2"), TODAY)[0].message).toMatch(/^Certificate of insurance expired /);
    expect(vendorAlerts(byId("v-1"), TODAY)).toEqual([{ severity: "warning", message: "Certificate of insurance expires in 15 days." }]);
  });
  it("shows outstanding documents and pending approval as info, and nothing for inactive vendors", () => {
    expect(vendorAlerts(byId("v-3"), TODAY).map((a) => a.message)).toEqual(["2 required documents outstanding."]);
    expect(vendorAlerts(byId("v-4"), TODAY)).toEqual([{ severity: "info", message: "Awaiting approval." }]);
    expect(vendorAlerts(byId("v-6"), TODAY)).toEqual([]);
  });
  it("treats an optional expired document as a warning only", () => {
    const v = vendor({ documents: [doc({ required: false, receivedOn: "2026-01-01", expiresOn: addDays(TODAY, -2) })] });
    expect(vendorAlerts(v, TODAY)[0].severity).toBe("warning");
  });
});

describe("duplicate detection", () => {
  it("normalizes legal suffixes, punctuation and a leading 'the'", () => {
    expect(normalizeName("The Acme Co., Inc.")).toBe("acme");
    expect(normalizeName("Smith & Sons LLC")).toBe("smith and sons");
    expect(normalizeName("Inc")).toBe("inc");
  });
  it("computes edit distance", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
  });
  it("flags similar names and shared company email domains", () => {
    const pairs = duplicatePairs(all);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.id).toBe("v-1");
    expect(pairs[0].b.id).toBe("v-5");
    expect(pairs[0].reasons).toEqual(["Similar name", "Same email domain"]);
  });
  it("matches on tax ID and exact email, but not on free mail domains", () => {
    const a = { name: "Alpha Works", email: "x@gmail.com", taxId: "111111111" };
    expect(findDuplicates([vendor({ id: "1", name: "Zed Corp", email: "y@gmail.com", taxId: "" })], a)).toEqual([]);
    expect(findDuplicates([vendor({ id: "1", name: "Zed Corp", email: "y@gmail.com", taxId: "111111111" })], a)[0].reasons).toEqual(["Same tax ID"]);
    expect(findDuplicates([vendor({ id: "1", name: "Zed Corp", email: "X@GMAIL.com" })], a)[0].reasons).toEqual(["Same contact email"]);
  });
  it("can ignore the record being edited", () => {
    const v = byId("v-1");
    expect(findDuplicates([v], v, v.id)).toEqual([]);
    expect(findDuplicates([v], v)).not.toEqual([]);
  });
  it("does not flag short or clearly different names", () => {
    expect(findDuplicates([vendor({ id: "1", name: "Acme", email: "" })], { name: "Acne", email: "", taxId: "" })).toEqual([]);
    expect(findDuplicates([vendor({ id: "1", name: "Northwind Traders", email: "" })], { name: "Contoso Limited", email: "", taxId: "" })).toEqual([]);
  });
});

describe("summary, attention and csv", () => {
  it("summarizes the sample vendors", () => {
    expect(summarize(all, TODAY)).toEqual({ vendors: 6, approved: 2, pendingApproval: 1, documentIssues: 2, duplicatePairs: 1 });
  });
  it("ranks critical alerts before warnings", () => {
    expect(needsAttention(all, TODAY).map((n) => [n.vendor.id, n.alert.severity])).toEqual([["v-2", "critical"], ["v-1", "warning"]]);
  });
  it("exports one row per vendor with document issues and neutralised formulas", () => {
    const csv = vendorsToCsv([{ ...byId("v-2"), name: "=EVIL()" }], TODAY);
    const [header, row] = csv.trimEnd().split("\r\n");
    expect(header).toBe("Name,Category,Status,Contact,Email,Phone,Tax ID,Required docs in,Required docs total,Document issues");
    expect(row).toContain("'=EVIL()");
    expect(row).toContain("Certificate of insurance (expired)");
  });
});

describe("forms", () => {
  const ok = { name: "Initech", category: "Supplies", contactName: "", email: "a@b.co", phone: "", taxId: "", notes: "" };
  it("accepts a minimal vendor and normalizes the tax ID", () => {
    expect(vendorFormSchema.parse(ok).taxId).toBe("");
    expect(vendorFormSchema.parse({ ...ok, taxId: "12-3456789" }).taxId).toBe("123456789");
    expect(vendorFormSchema.parse({ ...ok, phone: "+1 (555) 010-2200" }).phone).toBe("+1 (555) 010-2200");
  });
  it("accepts every phone format used in the sample data (regression: leading bracket)", () => {
    for (const v of all) expect(vendorFormSchema.safeParse({ ...ok, phone: v.phone }).success, v.phone).toBe(true);
  });
  it.each([
    [{ name: "x" }, "vendor name"], [{ email: "" }, "contact email"], [{ email: "nope" }, "valid email"],
    [{ taxId: "123" }, "12-3456789"], [{ phone: "abc" }, "valid phone"], [{ category: "Food" }, ""],
  ])("rejects %j", (patch, text) => {
    const r = vendorFormSchema.safeParse({ ...ok, ...patch });
    expect(r.success).toBe(false);
    if (!r.success && text) expect(JSON.stringify(r.error.issues)).toContain(text);
  });
  it("validates a document name", () => {
    expect(documentFormSchema.safeParse({ type: "Permit", required: true }).success).toBe(true);
    expect(documentFormSchema.safeParse({ type: " ", required: true }).success).toBe(false);
  });
});
