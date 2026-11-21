import { invoiceState } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import type { Contact } from "@/lib/contacts/types";
import type { Vendor } from "@/lib/vendors/types";

/** The comparable form of a name or email: lower case, trimmed, runs of spaces and punctuation collapsed. */
export const keyOf = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const sameEmail = (a: string, b: string) => !!a.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();
const sameName = (a: string, b: string) => !!keyOf(a) && keyOf(a) === keyOf(b);

/** Invoices addressed to this contact: the same email, or billed to their name or company. Newest first. */
export function invoicesForContact(c: Pick<Contact, "name" | "email" | "company">, invoices: Invoice[]): Invoice[] {
  return invoices
    .filter((i) => sameEmail(i.clientEmail, c.email) || sameName(i.client, c.name) || sameName(i.client, c.company))
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
}

export interface InvoiceSummary { count: number; billedCents: number; paidCents: number; outstandingCents: number; overdue: number }

/** Totals across a contact's invoices. Drafts and voided invoices are not counted as billed. */
export function summarizeInvoices(list: Invoice[], today: string): InvoiceSummary {
  let billed = 0, paid = 0, outstanding = 0, overdue = 0;
  for (const i of list) {
    if (i.status === "draft" || i.status === "void") continue;
    billed += i.amountCents;
    if (i.status === "paid") paid += i.amountCents;
    else {
      outstanding += i.amountCents;
      if (invoiceState(i, today) === "overdue") overdue += 1;
    }
  }
  return { count: list.length, billedCents: billed, paidCents: paid, outstandingCents: outstanding, overdue };
}

/** Vendors that are probably this contact: the same email, or the vendor's name matches the contact's company or name. */
export function vendorsForContact(c: Pick<Contact, "name" | "email" | "company">, vendors: Vendor[]): Vendor[] {
  return vendors.filter((v) => sameEmail(v.email, c.email) || sameName(v.name, c.company) || sameName(v.name, c.name));
}

/** Contacts that are probably this vendor's people: the same email, or a company that matches the vendor's name. */
export function contactsForVendor(v: Pick<Vendor, "name" | "email" | "contactName">, contacts: Contact[]): Contact[] {
  return contacts.filter((c) => sameEmail(c.email, v.email) || sameName(c.company, v.name) || (!!v.contactName && sameName(c.name, v.contactName) && !!c.company && sameName(c.company, v.name)));
}

/** Projects linked to a contact or vendor by name (the link a project keeps), most recently listed first. */
export function projectsLinkedTo<P extends { linked?: { kind: "contact" | "vendor"; name: string } | null; name: string }>(kind: "contact" | "vendor", name: string, projects: P[]): P[] {
  const k = keyOf(name);
  return projects.filter((p) => p.linked && p.linked.kind === kind && keyOf(p.linked.name) === k);
}

export interface TimelineEntry { on: string; text: string; href?: string }

/** One dated list of what happened with a contact: when they were added, each invoice issued and paid, and the last time they were contacted. Newest first. */
export function contactTimeline(c: { name: string; createdOn: string; lastContacted?: string | null }, invoices: Invoice[]): TimelineEntry[] {
  const out: TimelineEntry[] = [{ on: c.createdOn, text: `${c.name} added to Contacts` }];
  if (c.lastContacted) out.push({ on: c.lastContacted, text: "Last contacted" });
  for (const i of invoices) {
    if (i.status === "draft") continue;
    out.push({ on: i.issuedOn, text: `Invoice ${i.number} issued`, href: `/app/invoices?q=${encodeURIComponent(i.number)}` });
    if (i.status === "paid" && i.paidOn) out.push({ on: i.paidOn, text: `Invoice ${i.number} paid`, href: `/app/invoices?q=${encodeURIComponent(i.number)}` });
  }
  return out.filter((e) => /^\d{4}-\d{2}-\d{2}/.test(e.on)).sort((a, b) => b.on.localeCompare(a.on));
}
