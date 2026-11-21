import { describe, expect, it } from "vitest";
import { licenseSummaryText, licensesToCsv } from "@/lib/licenses/summary";
import { vendorSummaryText } from "@/lib/vendors/summary";
import type { License } from "@/lib/licenses/types";
import type { Vendor } from "@/lib/vendors/types";

const lic = { id: "l1", name: "Contractor license", category: "professional", issuer: "State", number: "C-1", holder: "Acme", issuedOn: "2025-01-01", expiresOn: "2026-12-01", renewalTermMonths: 12, reminderDays: [30], stage: "not_started", requiredDocuments: [{ id: "d", label: "Receipt", received: false }], notes: "" } as License;
const ven = { id: "v1", name: "Acme Supply", category: "Supplies", contactName: "", email: "a@b.co", phone: "", taxId: "", notes: "", status: "active", createdOn: "2026-01-01", documents: [{ id: "d1", type: "W-9", required: true, receivedOn: null, expiresOn: null }] } as unknown as Vendor;

describe("compliance summaries", () => {
  it("lists each license with standing and missing documents", () => {
    const t = licenseSummaryText([lic], "2026-11-21", "Acme");
    expect(t).toContain("Acme: Licenses and renewals summary");
    expect(t).toContain("Contractor license [Expiring soon]");
    expect(t).toContain("Missing documents: Receipt");
  });
  it("exports CSV with a header", () => {
    expect(licensesToCsv([lic], "2026-11-21").split("\r\n")[0]).toContain("Expires");
  });
  it("puts vendors with problems first", () => {
    const t = vendorSummaryText([ven], "2026-11-21");
    expect(t).toContain("W-9: Missing");
    expect(t).toContain("1 with missing or expired documents");
  });
});
