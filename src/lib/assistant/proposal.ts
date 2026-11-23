import { addDays, isDay } from "@/lib/dates";
import { findMatches, validateContact } from "@/lib/contacts/logic";
import type { Contact } from "@/lib/contacts/types";
import { describeItems, generateInvoiceNumber, invoiceTotals } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { invoiceFormSchema, parseDollars } from "@/lib/invoices/validation";
import { defaultRequirements } from "@/lib/vendors/logic";
import type { Vendor } from "@/lib/vendors/types";
import { vendorFormSchema } from "@/lib/vendors/validation";
import type { AuditArea } from "@/lib/audit/logic";
import { buildDraft, draftFromParams } from "./guardrails";

/**
 * "AI proposes, the owner approves, the system saves."
 *
 * Claude can only hand back a proposal: which service, and the exact fields. The page shows it in plain words with
 * Approve, Reject and Edit. Approve runs `applyProposal` below, the same validation the forms use, in the owner's own
 * session, so their role decides whether the save is allowed. Claude is not called again, so approving costs no tokens.
 * Deleting, paying, sending and signing are not proposable, and a proposal expires after 24 hours.
 */
export const PROPOSABLE = ["contacts", "vendors", "invoices"] as const;
export type Proposable = (typeof PROPOSABLE)[number];
export const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

export interface Proposal {
  id: string;
  service: Proposable;
  /** Only fields the service allows, each already checked. */
  fields: Record<string, string>;
  title: string;
  lines: { label: string; value: string }[];
  /** The service's own form, opened with these details, for Edit. */
  href: string;
  expiresAt: number;
}

const LABELS: Record<string, string> = {
  name: "Name", email: "Email", phone: "Phone", company: "Company", category: "Category", contactName: "Contact person",
  client: "Client", clientEmail: "Client email", description: "For", amount: "Amount", dueOn: "Due", recurrence: "Repeats",
};
const REQUIRED: Record<Proposable, string[]> = { contacts: ["name"], vendors: ["name", "email"], invoices: ["client", "amount"] };
const money = (v: string) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type BuildResult = { ok: true; proposal: Proposal } | { ok: false; error: string };

/** Checks what Claude wants to propose against the service's rules and turns it into a card. */
export function buildProposal(serviceId: string, input: unknown, now: number, id: string): BuildResult {
  if (!(PROPOSABLE as readonly string[]).includes(serviceId)) return { ok: false, error: `I can propose changes only for: ${PROPOSABLE.join(", ")}. For other services, use prepare_draft.` };
  const service = serviceId as Proposable;
  const built = buildDraft(service, input);
  if (!built.ok) return { ok: false, error: built.error };
  const params = new URL(built.href, "http://x").searchParams;
  const fields = draftFromParams(service, (k) => params.get(k) ?? undefined);
  const missing = REQUIRED[service].filter((k) => !fields[k]);
  if (missing.length) return { ok: false, error: `Ask the owner for: ${missing.map((k) => LABELS[k] ?? k).join(", ")}.` };
  const lines = Object.entries(fields).map(([k, v]) => ({ label: LABELS[k] ?? k, value: k === "amount" ? money(v) : v }));
  const title = service === "contacts" ? `Add the contact ${fields.name}` : service === "vendors" ? `Add the vendor ${fields.name}` : `Create a draft invoice for ${fields.client}`;
  return { ok: true, proposal: { id, service, fields, title, lines, href: built.href, expiresAt: now + PROPOSAL_TTL_MS } };
}

export interface ApplyContext {
  today: string;
  now: number;
  contacts: Contact[];
  vendors: Vendor[];
  invoices: Invoice[];
  newId: (prefix: string) => string;
}

export type Applied =
  | { ok: true; kind: "contacts"; record: Contact; text: string; audit: Audit }
  | { ok: true; kind: "vendors"; record: Vendor; text: string; audit: Audit }
  | { ok: true; kind: "invoices"; record: Invoice; text: string; audit: Audit }
  | { ok: false; error: string };
export interface Audit { verb: string; what: string; area: AuditArea; href: string }

/** Turns an approved proposal into the record the form would have saved. Pure: the caller writes it and can undo it by id. */
export function applyProposal(p: Proposal, ctx: ApplyContext): Applied {
  if (ctx.now > p.expiresAt) return { ok: false, error: "This proposal expired. Ask Addy again." };
  const f = p.fields;

  if (p.service === "contacts") {
    const checked = validateContact({ name: f.name, email: f.email, phone: f.phone, company: f.company, category: f.category });
    if (!checked.value) return { ok: false, error: Object.values(checked.errors).join(" ") };
    const dup = findMatches(ctx.contacts, checked.value)[0];
    if (dup) return { ok: false, error: `There is already a contact like this (${dup.contact.name}). Use Edit to review it.` };
    const record: Contact = { ...checked.value, id: ctx.newId("c"), createdOn: ctx.today };
    return { ok: true, kind: "contacts", record, text: `${record.name} added to Contacts.`, audit: { verb: "approved Addy's proposal to add", what: `the contact ${record.name}`, area: "Contacts", href: "/app/contacts" } };
  }

  if (p.service === "vendors") {
    const parsed = vendorFormSchema.safeParse({ name: f.name, category: f.category || "Other", contactName: f.contactName ?? "", email: f.email, phone: f.phone ?? "", taxId: "", notes: "" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    if (ctx.vendors.some((v) => v.name.trim().toLowerCase() === parsed.data.name.toLowerCase())) return { ok: false, error: `There is already a vendor named ${parsed.data.name}. Use Edit to review it.` };
    const documents = defaultRequirements(parsed.data.category).map((r) => ({ id: ctx.newId("vd"), type: r.type, required: true, receivedOn: null, expiresOn: null }));
    const record: Vendor = { ...parsed.data, id: ctx.newId("v"), status: "onboarding", createdOn: ctx.today, documents };
    return { ok: true, kind: "vendors", record, text: `${record.name} added to Vendors. Collect its ${documents.length} required documents, then activate it.`, audit: { verb: "approved Addy's proposal to add", what: `the vendor ${record.name}`, area: "Vendors", href: "/app/vendors" } };
  }

  // Invoices start as a draft, from the business details of the most recent invoice. Nothing is sent.
  const last = [...ctx.invoices].sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : -1))[0];
  if (!last) return { ok: false, error: "There is no earlier invoice to copy your business details from. Use Edit and fill in the From section first." };
  const cents = parseDollars(f.amount ?? "");
  if (cents === null) return { ok: false, error: "The amount is not a plain dollar amount." };
  const dueOn = f.dueOn && isDay(f.dueOn) ? f.dueOn : addDays(ctx.today, 30);
  const parsed = invoiceFormSchema.safeParse({
    number: generateInvoiceNumber(ctx.today, ctx.invoices.map((i) => i.number)),
    fromName: last.sender.name, fromAddress: last.sender.address, fromPhone: last.sender.phone, fromEmail: last.sender.email,
    client: f.client, clientEmail: f.clientEmail ?? "",
    items: [{ description: f.description || "Services", qty: "1", rate: (cents / 100).toFixed(2) }],
    taxRate: "", issuedOn: ctx.today, dueOn, paymentMethods: last.paymentMethods.join("\n"), recurrence: f.recurrence || "none", reminderDays: "", notes: "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  const v = parsed.data;
  const items = v.items.map((i) => ({ description: i.description, qty: i.qty, rateCents: i.rate }));
  const record: Invoice = {
    number: v.number, client: v.client, clientEmail: v.clientEmail, items, taxRate: v.taxRate, description: describeItems(items),
    amountCents: invoiceTotals(items, v.taxRate).totalCents, sender: { name: v.fromName, address: v.fromAddress, phone: v.fromPhone, email: v.fromEmail },
    paymentMethods: v.paymentMethods, issuedOn: v.issuedOn, dueOn: v.dueOn, recurrence: v.recurrence as Invoice["recurrence"], reminderDays: v.reminderDays, notes: v.notes,
    id: ctx.newId("inv"), status: "draft", paidOn: null,
  };
  return { ok: true, kind: "invoices", record, text: `${record.number} created as a draft. Open it in Invoices to review and send.`, audit: { verb: "approved Addy's proposal to create", what: `invoice ${record.number}`, area: "Invoices", href: "/app/invoices" } };
}
