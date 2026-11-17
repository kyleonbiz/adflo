import { toCsv } from "@/lib/csv";
import { effectivePriceCents, formatMoney, type ClientRecord, type Plan } from "./types";

/**
 * Manual invoicing for AdFlo's own clients. Records live in the browser for now (no payment processor, nothing
 * is emailed, no database table), so everything here is plain data and pure functions.
 */
export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
/** What the table shows: a sent invoice past its due date reads "overdue". */
export type DisplayStatus = InvoiceStatus | "overdue";

export const PAYMENT_METHODS = ["Bank transfer", "Check", "Cash", "Card (outside AdFlo)", "Other"] as const;

export interface BillingInvoice {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  description: string;
  amountCents: number;
  issuedOn: string; // YYYY-MM-DD
  dueOn: string;
  status: InvoiceStatus;
  paidOn: string | null;
  method: string;
  note: string;
}

export const STATUS_TEXT: Record<DisplayStatus, string> = { draft: "Draft", sent: "Sent", paid: "Paid", void: "Void", overdue: "Overdue" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: string) => ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const displayStatus = (inv: Pick<BillingInvoice, "status" | "dueOn">, today: string): DisplayStatus =>
  inv.status === "sent" && inv.dueOn < today ? "overdue" : inv.status;

/** Next free number: AF-0001, AF-0002, ... (never reuses a voided one). */
export function nextNumber(list: Pick<BillingInvoice, "number">[]): string {
  const max = list.reduce((m, i) => Math.max(m, Number(/^AF-(\d+)$/.exec(i.number)?.[1] ?? 0)), 0);
  return `AF-${String(max + 1).padStart(4, "0")}`;
}

/** "$1,200.50", "1200", "1,200.5" -> cents; null when it is not a positive amount with at most two decimals. */
export function parseDollars(input: string): number | null {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

export interface InvoiceForm { clientId: string; description: string; amount: string; issuedOn: string; dueOn: string; note: string }
export type InvoiceFormResult =
  | { ok: true; value: { clientId: string; description: string; amountCents: number; issuedOn: string; dueOn: string; note: string } }
  | { ok: false; errors: Partial<Record<keyof InvoiceForm, string>> };

export function validateInvoiceForm(f: InvoiceForm, clientIds: string[]): InvoiceFormResult {
  const errors: Partial<Record<keyof InvoiceForm, string>> = {};
  if (!clientIds.includes(f.clientId)) errors.clientId = "Choose a client.";
  const description = f.description.trim();
  if (description.length < 2 || description.length > 200) errors.description = "Describe what this is for (2 to 200 characters).";
  const amountCents = parseDollars(f.amount);
  if (amountCents == null) errors.amount = "Enter an amount above $0, like 99 or 1,200.50.";
  if (!isDate(f.issuedOn)) errors.issuedOn = "Enter the issue date.";
  if (!isDate(f.dueOn)) errors.dueOn = "Enter the due date.";
  else if (isDate(f.issuedOn) && f.dueOn < f.issuedOn) errors.dueOn = "The due date cannot be before the issue date.";
  if (f.note.length > 500) errors.note = "Keep the note under 500 characters.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { clientId: f.clientId, description, amountCents: amountCents!, issuedOn: f.issuedOn, dueOn: f.dueOn, note: f.note.trim() } };
}

export interface BillingSummary { outstandingCents: number; overdueCents: number; overdueCount: number; paidThisMonthCents: number; draftCents: number }

export function summarize(list: BillingInvoice[], today: string): BillingSummary {
  const month = today.slice(0, 7);
  const s: BillingSummary = { outstandingCents: 0, overdueCents: 0, overdueCount: 0, paidThisMonthCents: 0, draftCents: 0 };
  for (const i of list) {
    const st = displayStatus(i, today);
    if (st === "sent" || st === "overdue") s.outstandingCents += i.amountCents;
    if (st === "overdue") { s.overdueCents += i.amountCents; s.overdueCount += 1; }
    if (st === "paid" && i.paidOn?.startsWith(month)) s.paidThisMonthCents += i.amountCents;
    if (st === "draft") s.draftCents += i.amountCents;
  }
  return s;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/**
 * Drafts for this month's subscriptions: one per ACTIVE client with a price, skipping any client that already
 * has an invoice for the month (voided ones do not count). Trials, suspended and cancelled clients are not billed.
 */
export function monthlyDrafts(clients: ClientRecord[], plans: Plan[], existing: BillingInvoice[], today: string, dueDays = 14): BillingInvoice[] {
  const label = monthLabel(today);
  const out: BillingInvoice[] = [];
  for (const c of clients) {
    if (c.status !== "active") continue;
    const cents = effectivePriceCents(c, plans);
    if (!cents || cents <= 0) continue;
    const description = `AdFlo ${c.plan} · ${label}`;
    if (existing.some((i) => i.clientId === c.id && i.description === description && i.status !== "void")) continue;
    out.push({
      id: `inv-${c.id}-${today.slice(0, 7)}`, number: nextNumber([...existing, ...out]), clientId: c.id, clientName: c.name, description,
      amountCents: cents, issuedOn: today, dueOn: addDays(today, dueDays), status: "draft", paidOn: null, method: "", note: "",
    });
  }
  return out;
}

export function invoicesCsv(list: BillingInvoice[], today: string): string {
  return toCsv([
    ["Number", "Client", "Description", "Amount", "Issued", "Due", "Status", "Paid on", "Method", "Note"],
    ...list.map((i) => [i.number, i.clientName, i.description, (i.amountCents / 100).toFixed(2), i.issuedOn, i.dueOn, STATUS_TEXT[displayStatus(i, today)], i.paidOn ?? "", i.method, i.note]),
  ]);
}

/** Plain text of one invoice, for pasting into an email. */
export function invoiceText(i: BillingInvoice): string {
  return [
    `Invoice ${i.number}`, `To: ${i.clientName}`, `For: ${i.description}`, `Amount due: ${formatMoney(i.amountCents)}`,
    `Issued: ${i.issuedOn}`, `Due: ${i.dueOn}`, ...(i.note ? [`Note: ${i.note}`] : []), "", "Thank you. AdFlo",
  ].join("\n");
}

export const SAMPLE_INVOICES = (today: string): BillingInvoice[] => [
  { id: "s-1", number: "AF-0001", clientId: "sample-1", clientName: "Sample: Acme Roofing", description: `AdFlo standard · ${monthLabel(addDays(today, -35))}`, amountCents: 9900, issuedOn: addDays(today, -35), dueOn: addDays(today, -21), status: "paid", paidOn: addDays(today, -18), method: "Bank transfer", note: "" },
  { id: "s-2", number: "AF-0002", clientId: "sample-1", clientName: "Sample: Acme Roofing", description: `AdFlo standard · ${monthLabel(addDays(today, -5))}`, amountCents: 9900, issuedOn: addDays(today, -5), dueOn: addDays(today, 9), status: "sent", paidOn: null, method: "", note: "" },
  { id: "s-3", number: "AF-0003", clientId: "sample-2", clientName: "Sample: Birch & Co", description: "Setup and onboarding", amountCents: 25000, issuedOn: addDays(today, -30), dueOn: addDays(today, -16), status: "sent", paidOn: null, method: "", note: "Second reminder sent" },
];
