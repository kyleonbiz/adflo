import { describe, expect, it } from "vitest";
import { contactsForVendor, invoicesForContact, keyOf, summarizeInvoices, vendorsForContact } from "@/lib/profiles/logic";
import type { Contact } from "@/lib/contacts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Vendor } from "@/lib/vendors/types";

const inv = (o: Partial<Invoice>): Invoice => ({
  id: "i", number: "INV-1", client: "Acme", clientEmail: "", description: "", items: [], taxRate: 0,
  sender: { name: "", address: "", phone: "", email: "" }, paymentMethods: [], amountCents: 10000,
  issuedOn: "2026-10-01", dueOn: "2026-10-31", status: "sent", paidOn: null, recurrence: "none", reminderDays: [], notes: "", ...o,
});
const contact = (o: Partial<Contact> = {}): Contact => ({
  id: "c1", name: "Dana Reyes", email: "dana@acme.com", phone: "", company: "Acme Roofing", category: "Customer", notes: "", lastContacted: "", createdOn: "2026-01-01", ...o,
});
const vendor = (o: Partial<Vendor> = {}): Vendor => ({
  id: "v1", name: "Acme Roofing", category: "Construction & trades", contactName: "Dana Reyes", email: "office@acme.com", phone: "", taxId: "",
  notes: "", status: "active", createdOn: "2026-01-01", documents: [], ...o,
});

describe("keyOf", () => {
  it("ignores case, punctuation and extra spaces", () => {
    expect(keyOf("  Acme,  Roofing. LLC ")).toBe(keyOf("acme roofing llc"));
  });
});

describe("invoicesForContact", () => {
  it("matches by email, name or company, newest first, and skips others", () => {
    const list = [
      inv({ id: "a", clientEmail: "DANA@acme.com", issuedOn: "2026-09-01" }),
      inv({ id: "b", client: "dana reyes", issuedOn: "2026-10-05" }),
      inv({ id: "c", client: "Acme Roofing", issuedOn: "2026-08-01" }),
      inv({ id: "d", client: "Somebody Else", clientEmail: "x@y.com" }),
    ];
    expect(invoicesForContact(contact(), list).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
  it("never matches on an empty email or name", () => {
    expect(invoicesForContact(contact({ email: "", company: "" }), [inv({ client: "", clientEmail: "" })])).toEqual([]);
  });
});

describe("summarizeInvoices", () => {
  it("separates billed, paid and outstanding, and counts overdue, ignoring drafts and voids", () => {
    const list = [
      inv({ id: "1", status: "paid", paidOn: "2026-10-10", amountCents: 5000 }),
      inv({ id: "2", status: "sent", dueOn: "2026-10-31", amountCents: 7000 }),
      inv({ id: "3", status: "draft", amountCents: 99999 }),
      inv({ id: "4", status: "void", amountCents: 88888 }),
    ];
    const s = summarizeInvoices(list, "2026-11-18");
    expect(s).toMatchObject({ count: 4, billedCents: 12000, paidCents: 5000, outstandingCents: 7000, overdue: 1 });
  });
});

describe("vendor and contact links", () => {
  it("finds a vendor from a contact's company, and the contact's people from a vendor", () => {
    expect(vendorsForContact(contact(), [vendor(), vendor({ id: "v2", name: "Other Co" })]).map((v) => v.id)).toEqual(["v1"]);
    expect(contactsForVendor(vendor(), [contact(), contact({ id: "c2", company: "Nope", email: "n@n.com", name: "N" })]).map((c) => c.id)).toEqual(["c1"]);
  });
  it("links by matching email too", () => {
    expect(contactsForVendor(vendor({ email: "dana@acme.com", name: "X" }), [contact({ company: "" })]).map((c) => c.id)).toEqual(["c1"]);
  });
});
