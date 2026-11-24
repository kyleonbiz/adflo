import { beforeEach, describe, expect, it } from "vitest";
import { WS_A, makeWorld, uploadFile, type World } from "../support/world";
import { nameStem } from "@/lib/dms/service";

let w: World;
beforeEach(() => { w = makeWorld(); });
const bytes = (s: string) => new TextEncoder().encode(s);
const text = { type: "text/plain" };
const INVOICE = "Acme Supply Co\nInvoice Number: INV-1042\nInvoice Date: 11/04/2026\nDue Date: 12/04/2026\nAmount Due: $129.60\n";

describe("readBill", () => {
  it("reads an invoice, and says why when it cannot", async () => {
    const editor = w.as(WS_A, "editor");
    const doc = await uploadFile(w, editor, { name: "Invoice_1042.txt", ...text, bytes: bytes(INVOICE) });
    expect(doc.category).toBe("invoice");
    const r = await w.as(WS_A, "viewer").readBill(doc.id);
    expect(r).toMatchObject({ status: "found", bill: { number: "INV-1042", totalCents: 12960, dueOn: "2026-12-04" } });
    const empty = await uploadFile(w, editor, { name: "Receipt_notes.txt", ...text, bytes: bytes("Bought some things for the shop last week, will sort later.") });
    expect(await editor.readBill(empty.id)).toEqual({ status: "no_details" });
    const photo = await uploadFile(w, editor, { name: "receipt.jpg", type: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]) });
    expect(await editor.readBill(photo.id)).toEqual({ status: "unreadable" });
  });

  it("only reads invoices and receipts", async () => {
    const doc = await uploadFile(w, w.as(WS_A, "editor"), { name: "Contract_signed.txt", ...text, bytes: bytes(INVOICE) });
    expect(await w.as(WS_A, "viewer").readBill(doc.id)).toEqual({ status: "not_bill" });
  });
});

describe("findDuplicates", () => {
  it("finds a file with the same size and name, ignoring (1), copy and extension", async () => {
    const editor = w.as(WS_A, "editor");
    const a = await uploadFile(w, editor, { name: "Insurance policy.txt", ...text, bytes: bytes("same content here") });
    const b = await uploadFile(w, editor, { name: "Insurance policy (1).txt", ...text, bytes: bytes("same content here") });
    await uploadFile(w, editor, { name: "Insurance policy.txt", ...text, bytes: bytes("different length content here") });
    await uploadFile(w, editor, { name: "Other file.txt", ...text, bytes: bytes("same content here") });
    expect((await editor.findDuplicates(b.id)).map((d) => d.id)).toEqual([a.id]);
    expect((await editor.findDuplicates(a.id)).map((d) => d.id)).toEqual([b.id]);
  });

  it("finds nothing for a unique file", async () => {
    const editor = w.as(WS_A, "editor");
    const a = await uploadFile(w, editor, { name: "unique.txt", ...text, bytes: bytes("only one") });
    expect(await editor.findDuplicates(a.id)).toEqual([]);
  });
});

describe("nameStem", () => {
  it("compares names, not decorations", () => {
    expect(nameStem("C:\\docs\\Report - Copy.pdf")).toBe("report");
    expect(nameStem("Report (2).PDF")).toBe("report");
    expect(nameStem("copy of Report.pdf")).toBe("report");
  });
});
