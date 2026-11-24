import { describe, expect, it } from "vitest";
import { alreadyTracked, certificateExpiry, certificateToLicenses, daysUntilExpiry, extractCertificate } from "@/lib/licenses/certificate";

// An ACORD 25 as it often comes out of a PDF: rows of the coverage table on single lines.
const ACORD_ROWS = `CERTIFICATE OF LIABILITY INSURANCE                                  DATE (MM/DD/YYYY) 11/01/2026
THIS CERTIFICATE IS ISSUED AS A MATTER OF INFORMATION ONLY AND CONFERS NO RIGHTS UPON THE CERTIFICATE HOLDER.
PRODUCER
Harbor Insurance Group
INSURED
Acme Roofing LLC
412 Cedar Ave, Portland OR 97201
INSURER(S) AFFORDING COVERAGE            NAIC #
INSURER A : Travelers Indemnity Company   25658
INSURER B : Liberty Mutual Fire Ins Co    23035
COVERAGES   CERTIFICATE NUMBER: 2026-114   REVISION NUMBER:
A  X COMMERCIAL GENERAL LIABILITY   Y  GL-4471920   11/01/2026   11/01/2027   EACH OCCURRENCE $1,000,000
B  AUTOMOBILE LIABILITY   Y  BA-9921034   11/01/2026   11/01/2027   COMBINED SINGLE LIMIT $1,000,000
A  UMBRELLA LIAB   X OCCUR   UMB-221877   11/01/2026   11/01/2027   EACH OCCURRENCE $2,000,000
B  WORKERS COMPENSATION AND EMPLOYERS' LIABILITY   WC-5521908   11/01/2026   06/30/2027   PER STATUTE
CERTIFICATE HOLDER
Northwind Properties
12 Harbor St`;

// The same form with each cell on its own line.
const ACORD_CELLS = `CERTIFICATE OF LIABILITY INSURANCE
INSURED
Birch & Co
INSURER A : Hartford Fire Insurance Co
COMMERCIAL GENERAL LIABILITY
POLICY NUMBER
84 SBA 1234
01/15/2026
01/15/2027
WORKERS COMPENSATION
WC 7710293
01/15/2026
01/15/2027`;

const PLAIN = `Certificate of Insurance
Insured: Cedar Plumbing Inc
Insurance company: Pacific Mutual
Policy Number: PM-889231
Policy Period: 03/01/2026 to 03/01/2027
Certificate Holder: Northwind Properties`;

describe("extractCertificate: ACORD rows", () => {
  const c = extractCertificate(ACORD_ROWS)!;
  it("finds who is insured, the producer and the holder", () => {
    expect(c.insured).toBe("Acme Roofing LLC");
    expect(c.producer).toBe("Harbor Insurance Group");
    expect(c.holder).toBe("Northwind Properties");
  });
  it("finds each policy with its insurer, number and dates", () => {
    expect(c.policies.map((p) => p.kind)).toEqual(["General liability", "Auto liability", "Umbrella / excess liability", "Workers' compensation"]);
    expect(c.policies[0]).toEqual({ kind: "General liability", insurer: "Travelers Indemnity Company", policyNumber: "GL-4471920", effectiveOn: "2026-11-01", expiresOn: "2027-11-01" });
    expect(c.policies[1]).toMatchObject({ insurer: "Liberty Mutual Fire Ins Co", policyNumber: "BA-9921034" });
    expect(c.policies[3]).toMatchObject({ policyNumber: "WC-5521908", expiresOn: "2027-06-30" });
  });
  it("says when the certificate stops being good: the earliest expiry", () => {
    expect(certificateExpiry(c)).toBe("2027-06-30");
    expect(daysUntilExpiry(c, "2027-06-20")).toBe(10);
    expect(daysUntilExpiry(c, "2027-07-02")).toBe(-2);
  });
});

describe("extractCertificate: other layouts", () => {
  it("reads a form with each cell on its own line", () => {
    const c = extractCertificate(ACORD_CELLS)!;
    expect(c.insured).toBe("Birch & Co");
    expect(c.policies).toHaveLength(2);
    expect(c.policies[0]).toMatchObject({ kind: "General liability", insurer: "Hartford Fire Insurance Co", policyNumber: "84 SBA 1234", effectiveOn: "2026-01-15", expiresOn: "2027-01-15" });
  });
  it("reads a plain certificate with one policy", () => {
    const c = extractCertificate(PLAIN)!;
    expect(c.insured).toBe("Cedar Plumbing Inc");
    expect(c.holder).toBe("Northwind Properties");
    expect(c.policies).toEqual([{ kind: "Insurance policy", insurer: "Pacific Mutual", policyNumber: "PM-889231", effectiveOn: "2026-03-01", expiresOn: "2027-03-01" }]);
  });
  it("is null for text that is not a certificate, or has no dates", () => {
    expect(extractCertificate("Invoice 2041. Amount due $4,820. Thanks!")).toBeNull();
    expect(extractCertificate("CERTIFICATE OF LIABILITY INSURANCE\nINSURED\nAcme\nCOMMERCIAL GENERAL LIABILITY\nno dates here")).toBeNull();
    expect(extractCertificate("")).toBeNull();
  });
});

describe("turning a certificate into tracked records", () => {
  const c = extractCertificate(ACORD_ROWS)!;
  let n = 0;
  const licenses = certificateToLicenses(c, { newId: () => `id${++n}`, documentName: "Acme COI.pdf" });

  it("makes one insurance record per policy, ready to review", () => {
    expect(licenses).toHaveLength(4);
    expect(licenses[0]).toMatchObject({ name: "General liability insurance", category: "insurance", issuer: "Travelers Indemnity Company", number: "GL-4471920", holder: "Acme Roofing LLC", issuedOn: "2026-11-01", expiresOn: "2027-11-01", reminderDays: [60, 30, 7], stage: "not_started" });
    expect(licenses[0].verifiedOn).toBeUndefined(); // flagged for a review until someone confirms it
    expect(licenses[0].notes).toContain("Acme COI.pdf");
    expect(licenses[0].requiredDocuments[0].label).toBe("Updated certificate of insurance");
  });

  it("does not track a policy twice", () => {
    expect(alreadyTracked(c.policies[0], licenses)).toBe(true);
    expect(alreadyTracked(c.policies[0], [{ ...licenses[0], expiresOn: "2026-11-01" }])).toBe(false);
    expect(alreadyTracked(c.policies[0], [{ ...licenses[0], category: "permit" }])).toBe(false);
  });
});
