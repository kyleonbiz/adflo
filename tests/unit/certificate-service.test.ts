import { beforeEach, describe, expect, it } from "vitest";
import { WS_A, makeWorld, uploadFile, type World } from "../support/world";

const COI = `CERTIFICATE OF LIABILITY INSURANCE   DATE (MM/DD/YYYY) 11/01/2026
INSURED
Acme Roofing LLC
INSURER A : Travelers Indemnity Company   25658
A  X COMMERCIAL GENERAL LIABILITY   Y  GL-4471920   11/01/2026   11/01/2027   EACH OCCURRENCE $1,000,000
A  WORKERS COMPENSATION AND EMPLOYERS' LIABILITY   WC-5521908   11/01/2026   06/30/2027   PER STATUTE
CERTIFICATE HOLDER
Northwind Properties`;

const insuranceFolderId = "00000000-0000-4000-8000-0000000000f6";
let w: World;
beforeEach(() => {
  w = makeWorld();
  w.store.folders.set(insuranceFolderId, { id: insuranceFolderId, workspaceId: WS_A, name: "Insurance", color: "sky", isSystem: true, defaultCategory: "insurance", createdAt: "2026-11-01T00:00:00Z" });
});

const bytes = (s: string) => new TextEncoder().encode(s);
const text = { type: "text/plain" };

describe("readCertificate", () => {
  it("reads an insurance document as a certificate", async () => {
    const svc = w.as(WS_A, "viewer");
    const doc = await uploadFile(w, w.as(WS_A, "editor"), { name: "Acme_COI.txt", ...text, bytes: bytes(COI) });
    expect(doc.category).toBe("insurance"); // filed by its name
    const r = await svc.readCertificate(doc.id);
    expect(r.status).toBe("found");
    if (r.status !== "found") return;
    expect(r.certificate.insured).toBe("Acme Roofing LLC");
    expect(r.certificate.policies.map((p) => [p.kind, p.policyNumber, p.expiresOn])).toEqual([
      ["General liability", "GL-4471920", "2027-11-01"],
      ["Workers' compensation", "WC-5521908", "2027-06-30"],
    ]);
  });

  it("only reads insurance documents", async () => {
    const doc = await uploadFile(w, w.as(WS_A, "editor"), { name: "Invoice_2041.txt", ...text, bytes: bytes(COI) });
    expect(doc.category).toBe("invoice");
    expect(await w.as(WS_A, "viewer").readCertificate(doc.id)).toEqual({ status: "not_insurance" });
  });

  it("says when there is no readable text, or the text is not a certificate", async () => {
    const editor = w.as(WS_A, "editor");
    const photo = await uploadFile(w, editor, { name: "insurance_card.jpg", type: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]) }, { folderId: insuranceFolderId });
    expect(await editor.readCertificate(photo.id)).toEqual({ status: "unreadable" });
    const notes = await uploadFile(w, editor, { name: "policy notes.txt", ...text, bytes: bytes("Remember to call the agent about renewing, sometime next spring.") }, { folderId: insuranceFolderId });
    expect(await editor.readCertificate(notes.id)).toEqual({ status: "no_certificate" });
  });

  it("is not available for another workspace's document", async () => {
    await expect(w.as("00000000-0000-4000-8000-0000000000b0", "owner").readCertificate("00000000-0000-4000-8000-0000000000d1")).rejects.toThrow();
  });
});
