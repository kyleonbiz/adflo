import { addDays, advanceDay, daysBetween, isDay } from "@/lib/dates";
import { csvCell } from "@/lib/csv";
import type { Invoice, InvoiceAlert, InvoiceState, Recurrence } from "./types";

/** Within this many days of the due date an unpaid invoice is "due soon". */
export const DUE_SOON_DAYS = 7;
/** An invoice this many days late (or more) is a critical alert. */
export const SEVERELY_OVERDUE_DAYS = 14;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function invoiceState(inv: Invoice, today: string): InvoiceState {
  if (inv.status !== "sent") return inv.status;
  const left = daysBetween(today, inv.dueOn);
  if (left < 0) return "overdue";
  if (left === 0) return "due_today";
  return left <= DUE_SOON_DAYS ? "due_soon" : "upcoming";
}

export function daysOverdue(inv: Invoice, today: string): number {
  return inv.status === "sent" ? Math.max(0, daysBetween(inv.dueOn, today)) : 0;
}

/** Unpaid and sent: money the client still owes. */
export const isOutstanding = (inv: Invoice) => inv.status === "sent";

export function invoiceAlerts(inv: Invoice, today: string): InvoiceAlert[] {
  const state = invoiceState(inv, today);
  const left = daysBetween(today, inv.dueOn);
  switch (state) {
    case "overdue": {
      const late = -left;
      return [{
        severity: late >= SEVERELY_OVERDUE_DAYS ? "critical" : "warning",
        message: `${plural(late, "day")} overdue.`,
      }];
    }
    case "due_today": return [{ severity: "warning", message: "Due today." }];
    case "due_soon": return [{ severity: "info", message: `Due in ${plural(left, "day")}.` }];
    default: return [];
  }
}

/** The next payment reminder on or after `today` for a sent invoice, or null when none remain. */
export function nextReminder(inv: Invoice, today: string): { on: string; daysBefore: number } | null {
  if (inv.status !== "sent") return null;
  const upcoming = [...new Set(inv.reminderDays)]
    .map((daysBefore) => ({ daysBefore, on: addDays(inv.dueOn, -daysBefore) }))
    .filter((r) => r.on >= today)
    .sort((a, b) => (a.on < b.on ? -1 : 1));
  return upcoming[0] ?? null;
}

/**
 * Overdue notices repeat weekly after the due date. Returns the next one strictly after `today`
 * for an overdue invoice (a notice falling on `today` is treated as already sent).
 */
export function nextOverdueNotice(inv: Invoice, today: string): string | null {
  if (invoiceState(inv, today) !== "overdue") return null;
  const weeksLate = Math.floor(daysBetween(inv.dueOn, today) / 7);
  const next = addDays(inv.dueOn, (weeksLate + 1) * 7);
  return next;
}

export function advance(day: string, recurrence: Recurrence): string {
  return recurrence === "none" ? day : advanceDay(day, recurrence);
}

/** `INV-0041` -> `INV-0042`, skipping any number already in use. Falls back to appending `-2`. */
export function nextInvoiceNumber(current: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const m = /^(.*?)(\d+)$/.exec(current);
  if (!m) {
    let n = 2;
    while (used.has(`${current}-${n}`)) n++;
    return `${current}-${n}`;
  }
  const width = m[2].length;
  let n = Number(m[2]) + 1;
  while (used.has(`${m[1]}${String(n).padStart(width, "0")}`)) n++;
  return `${m[1]}${String(n).padStart(width, "0")}`;
}

/** The next invoice in a recurring series, as a draft with the same payment terms. Null for one-time invoices. */
export function nextRecurringInvoice(inv: Invoice, all: Invoice[], id: string): Invoice | null {
  if (inv.recurrence === "none") return null;
  const termDays = daysBetween(inv.issuedOn, inv.dueOn);
  const issuedOn = advance(inv.issuedOn, inv.recurrence);
  return {
    ...inv,
    id,
    number: nextInvoiceNumber(inv.number, all.map((i) => i.number)),
    issuedOn,
    dueOn: addDays(issuedOn, termDays),
    status: "draft",
    paidOn: null,
  };
}

/** True when the next invoice in `inv`'s recurring series already exists, so it is not created twice. */
export function hasNextInvoice(inv: Invoice, all: Invoice[]): boolean {
  if (inv.recurrence === "none") return false;
  const issuedOn = advance(inv.issuedOn, inv.recurrence);
  return all.some((o) => o.id !== inv.id && o.client === inv.client && o.recurrence === inv.recurrence
    && o.description === inv.description && o.issuedOn === issuedOn);
}

export const markSent = (inv: Invoice): Invoice => ({ ...inv, status: "sent", paidOn: null });
export const markPaid = (inv: Invoice, paidOn: string): Invoice => ({ ...inv, status: "paid", paidOn });
export const voidInvoice = (inv: Invoice): Invoice => ({ ...inv, status: "void", paidOn: null });
/** Undo a void (back to draft) or a payment (back to sent, outstanding again). */
export const reopen = (inv: Invoice): Invoice =>
  inv.status === "void" ? { ...inv, status: "draft" } : inv.status === "paid" ? { ...inv, status: "sent", paidOn: null } : inv;

/** Why `day` can't be the payment date for `inv`, or null when it can. */
export function paymentDateError(inv: Invoice, day: string, today: string): string | null {
  if (!isDay(day)) return "Enter a valid date";
  if (day < inv.issuedOn) return "Payment can't be before the invoice was issued";
  if (day > today) return "Payment date can't be in the future";
  return null;
}

export interface InvoiceSummary {
  outstandingCents: number;
  overdueCents: number;
  overdueCount: number;
  paidThisMonthCents: number;
  dueSoonCount: number;
}

export function summarize(invoices: Invoice[], today: string): InvoiceSummary {
  const month = today.slice(0, 7);
  const s: InvoiceSummary = { outstandingCents: 0, overdueCents: 0, overdueCount: 0, paidThisMonthCents: 0, dueSoonCount: 0 };
  for (const inv of invoices) {
    const state = invoiceState(inv, today);
    if (isOutstanding(inv)) s.outstandingCents += inv.amountCents;
    if (state === "overdue") { s.overdueCents += inv.amountCents; s.overdueCount++; }
    if (state === "due_soon" || state === "due_today") s.dueSoonCount++;
    if (inv.status === "paid" && inv.paidOn?.startsWith(month)) s.paidThisMonthCents += inv.amountCents;
  }
  return s;
}

/** Invoices that need action, most urgent first: overdue (latest first), then by due date. */
export function needsAttention(invoices: Invoice[], today: string): Invoice[] {
  const rank = (i: Invoice) => ({ overdue: 0, due_today: 1, due_soon: 2 } as Record<string, number>)[invoiceState(i, today)];
  return invoices
    .filter((i) => rank(i) !== undefined)
    .sort((a, b) => rank(a) - rank(b) || (a.dueOn < b.dueOn ? -1 : 1));
}

export function invoicesToCsv(invoices: Invoice[], today: string): string {
  const header = ["Number", "Client", "Description", "Amount", "Issued", "Due", "Status", "Days overdue", "Paid on", "Recurrence"];
  const rows = invoices.map((i) => [
    i.number, i.client, i.description, (i.amountCents / 100).toFixed(2), i.issuedOn, i.dueOn,
    i.status, daysOverdue(i, today), i.paidOn ?? "", i.recurrence,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
