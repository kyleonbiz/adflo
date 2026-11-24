import { beforeEach, describe, expect, it } from "vitest";
import { classifyByContent, classifyByName, classifyDocument } from "@/lib/dms/autosort";
import { WS_A, makeWorld, uploadFile, type World } from "../support/world";

describe("classifyByName", () => {
  it.each([
    ["Certificate_of_Insurance_2026.pdf", "insurance"],
    ["ACORD 25 - Acme Roofing.pdf", "insurance"],
    ["GL-COI-final.pdf", "insurance"],
    ["WorkersComp_policy.pdf", "insurance"],
    ["W-9 Acme Roofing.pdf", "tax"],
    ["2025 tax return.pdf", "tax"],
    ["1099-NEC_Smith.pdf", "tax"],
    ["resume_priya_shah.docx", "hr"],
    ["Offer Letter - J Cruz.pdf", "hr"],
    ["I-9 Cruz.pdf", "hr"],
    ["Invoice_INV-2041_Northwind.pdf", "invoice"],
    ["inv 3382.pdf", "invoice"],
    ["Home Depot receipt.jpg", "receipt"],
    ["Master Services Agreement.docx", "contract"],
    ["lease_unit4.pdf", "contract"],
  ])("%s is %s", (name, kind) => expect(classifyByName(name)).toBe(kind));

  it("does not guess when the name says nothing, or says two things", () => {
    for (const name of ["scan0412.pdf", "IMG_2231.jpg", "notes.txt", "Taxi receipt.pdf".replace("Taxi", "Lunch"), "Insurance Agreement.pdf", "invoice and receipt.pdf", ""]) {
      if (name === "Lunch receipt.pdf") continue; // a single clear word is fine
      expect(classifyByName(name), name).toBeNull();
    }
  });

  it("does not match words that only contain a keyword", () => {
    expect(classifyByName("Taxi ride.pdf")).toBeNull();
    expect(classifyByName("Reinvoiced items.pdf")).toBeNull();
    expect(classifyByName("cvs_pharmacy.pdf")).toBeNull();
  });
});

const COI = `CERTIFICATE OF LIABILITY INSURANCE   DATE 11/01/2026
THIS CERTIFICATE IS ISSUED AS A MATTER OF INFORMATION ONLY. ACORD 25 (2016/03)
PRODUCER Harbor Insurance Group   NAMED INSURED Acme Roofing LLC
POLICY NUMBER GL-4471920  POLICY EFFECTIVE 11/01/2026  POLICY EXPIRATION 11/01/2027
COMMERCIAL GENERAL LIABILITY  EACH OCCURRENCE $1,000,000   CERTIFICATE HOLDER Northwind Properties`;

const INVOICE = `INVOICE
Invoice Number: 2041   Invoice Date: Nov 3, 2026   Due Date: Nov 17, 2026
Bill To: Northwind Properties, 12 Harbor St
Description: Roof repair, labor and materials    Total Due: $4,820.00
Remit to: Acme Roofing LLC`;

const RECEIPT = `Home Supply Co.   Thank you for your purchase!
Items: 2x roofing nails, 1x sealant     Subtotal 38.10   Tax 3.05   Total 41.15
Visa ending 4417   Auth code 088231     Payment received - paid in full`;

const W9 = `Form W-9 (Rev. October 2018)  Department of the Treasury  Internal Revenue Service
Request for Taxpayer Identification Number and Certification
Give Form to the requester. Employer identification number 12-3456789`;

const CONTRACT = `SERVICES AGREEMENT. This Agreement is made between Acme Roofing LLC (the "Contractor") and Northwind Properties
(hereinafter "Client"). Scope of Work: replace roof on building 4. Governing law: State of Oregon.
Terms and conditions apply. The parties agree to indemnify each other. Signature: ____`;

const OFFER = `Offer letter. Dear Jordan Cruz, we are pleased to extend an offer of employment as Crew Lead.
Job title: Crew Lead. Please complete Form I-9 Employment Eligibility Verification and Form W-4 on your first day.`;

describe("classifyByContent", () => {
  it.each([
    [COI, "insurance"], [INVOICE, "invoice"], [RECEIPT, "receipt"], [W9, "tax"], [CONTRACT, "contract"], [OFFER, "hr"],
  ])("recognizes %#", (text, kind) => expect(classifyByContent(text)).toBe(kind));

  it("leaves thin, mixed or empty text alone", () => {
    expect(classifyByContent("")).toBeNull();
    expect(classifyByContent("See you at the job site tomorrow at 8am.")).toBeNull();
    expect(classifyByContent("Invoice attached. Please see the agreement for the terms.")).toBeNull();
    expect(classifyByContent("this agreement ".repeat(1) + "invoice number due date bill to".slice(0, 4))).toBeNull();
  });

  it("reads only the start of a long document", () => {
    const filler = "Lorem ipsum dolor sit amet. ".repeat(600); // ~16,800 chars
    expect(classifyByContent(filler + COI)).toBeNull();
    expect(classifyByContent(COI + filler)).toBe("insurance");
  });
});

describe("classifyDocument", () => {
  it("prefers the name, and falls back to the text", () => {
    expect(classifyDocument("W-9 Acme.pdf", INVOICE)).toEqual({ category: "tax", by: "name" });
    expect(classifyDocument("scan0412.pdf", COI)).toEqual({ category: "insurance", by: "content" });
    expect(classifyDocument("scan0412.pdf", null)).toBeNull();
  });
});

let w: World;
const insuranceFolderId = "00000000-0000-4000-8000-0000000000f6";
beforeEach(() => {
  w = makeWorld();
  w.store.folders.set(insuranceFolderId, {
    id: insuranceFolderId, workspaceId: WS_A, name: "Insurance", color: "sky", isSystem: true, defaultCategory: "insurance", createdAt: "2026-11-01T00:00:00Z",
  });
});

const auditOf = () => w.store.audit.filter((a) => a.action === "document.auto_sorted");
const bytesOf = (text: string) => new TextEncoder().encode(text);

describe("uploads are filed automatically", () => {
  it("files a clearly named upload into its standard folder and says so in the activity log", async () => {
    const svc = w.as(WS_A, "editor");
    const doc = await uploadFile(w, svc, { name: "Certificate_of_Insurance_2026.pdf" });
    expect(doc).toMatchObject({ category: "insurance", folderId: insuranceFolderId });
    expect(auditOf()).toHaveLength(1);
    expect(auditOf()[0].metadata).toMatchObject({ category: "insurance", folder: "Insurance", by: "name" });
  });

  it("leaves an upload alone when its name says nothing", async () => {
    const doc = await uploadFile(w, w.as(WS_A, "editor"), { name: "scan0412.pdf" });
    expect(doc).toMatchObject({ category: "other", folderId: null });
    expect(auditOf()).toHaveLength(0);
  });

  it("never overrides a folder or category the person chose", async () => {
    const svc = w.as(WS_A, "editor");
    const folderId = "00000000-0000-4000-8000-000000000011"; // Receipts
    const inFolder = await uploadFile(w, svc, { name: "Certificate_of_Insurance_2026.pdf" }, { folderId });
    expect(inFolder.folderId).toBe(folderId);
    expect(inFolder.category).not.toBe("insurance");
    expect(auditOf()).toHaveLength(0);
  });

  it("sorts by contents once the text is read, when the name said nothing", async () => {
    const svc = w.as(WS_A, "editor");
    const doc = await uploadFile(w, svc, { name: "scan_0412.txt", type: "text/plain", bytes: bytesOf(COI) });
    expect(doc).toMatchObject({ category: "other", folderId: null }); // not yet: the text is read in the next step
    await svc.indexDocument(doc.id, 1);
    const sorted = await w.repo.getDocument(WS_A, doc.id);
    expect(sorted).toMatchObject({ category: "insurance", folderId: insuranceFolderId });
    expect(auditOf()[0].metadata).toMatchObject({ by: "content" });
  });

  it("does not move a document someone has already filed while its text was being read", async () => {
    const svc = w.as(WS_A, "editor");
    const doc = await uploadFile(w, svc, { name: "scan_0413.txt", type: "text/plain", bytes: bytesOf(INVOICE) });
    const receiptsId = "00000000-0000-4000-8000-000000000011";
    await svc.updateDocument(doc.id, { folderId: receiptsId });
    await svc.indexDocument(doc.id, 1);
    expect((await w.repo.getDocument(WS_A, doc.id))!.folderId).toBe(receiptsId);
    expect(auditOf()).toHaveLength(0);
  });

  it("does not re-sort a new version of a document", async () => {
    const svc = w.as(WS_A, "editor");
    const doc = await uploadFile(w, svc, { name: "scan_0414.txt", type: "text/plain", bytes: bytesOf("hello there, just notes") });
    const v2 = await uploadFile(w, svc, { name: "scan_0414.txt", type: "text/plain", bytes: bytesOf(COI) }, { documentId: doc.id });
    await svc.indexDocument(doc.id, v2.currentVersion);
    expect(await w.repo.getDocument(WS_A, doc.id)).toMatchObject({ category: "other", folderId: null });
  });

  it("sets just the category when the workspace has no matching folder", async () => {
    w.store.folders.delete(insuranceFolderId);
    const doc = await uploadFile(w, w.as(WS_A, "editor"), { name: "Certificate_of_Insurance_2026.pdf" });
    expect(doc).toMatchObject({ category: "insurance", folderId: null });
  });
});
