import { addDays, daysBetween, formatDayLong } from "@/lib/dates";
import { brandedEmail } from "@/lib/mail/layout";
import { advance, daysOverdue, formatMoney, hasNextInvoice, nextRecurringInvoice } from "./logic";
import { invoicePath } from "./share";
import type { Invoice } from "./types";

/**
 * Invoice automation, for workspaces that have switched it on in Settings (off until then):
 *  - Payment reminders: emailed to the client before the due date (on each invoice's own reminder days), on the due date, and then
 *    three weekly overdue notices. Each goes out once, and they stop the moment the invoice is paid or voided.
 *  - Recurring invoices: the next invoice in a series is created on its issue date, as a draft for approval or sent straight away.
 * Everything here is pure; the daily job does the reading, sending and saving.
 */

/** Overdue notices go out this many days after the due date, then no more: after that it is a conversation to have, not an email. */
export const OVERDUE_NOTICE_DAYS = [7, 14, 21] as const;
/** A reminder missed on its day (a job that did not run) still goes out for this many days; after that it is dropped, never sent late. */
export const MISSED_REMINDER_GRACE_DAYS = 2;
/** The next invoice of a series is only created within this many days of its issue date, so an abandoned series is not brought back to life. */
export const RECURRING_CATCHUP_DAYS = 3;
/** One workspace creates at most this many invoices in a run. */
export const MAX_CREATED_PER_WORKSPACE = 50;

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f<>"]+/g, " ").replace(/\s{2,}/g, " ").trim();

export type ReminderKind = "upcoming" | "due" | "overdue";
export interface ReminderPoint { on: string; kind: ReminderKind }

/** Every date this invoice would be reminded on. Dates before it was issued are left out. */
export function reminderSchedule(inv: Invoice): ReminderPoint[] {
  const points: ReminderPoint[] = [];
  for (const d of new Set(inv.reminderDays)) if (Number.isInteger(d) && d > 0) points.push({ on: addDays(inv.dueOn, -d), kind: "upcoming" });
  points.push({ on: inv.dueOn, kind: "due" });
  for (const d of OVERDUE_NOTICE_DAYS) points.push({ on: addDays(inv.dueOn, d), kind: "overdue" });
  return points.filter((p) => p.on >= inv.issuedOn).sort((a, b) => (a.on < b.on ? -1 : 1));
}

/**
 * The reminder to email today, or null. Only for a sent invoice with a usable client email. It is the latest scheduled date that has
 * come, is within the grace period, and has not gone out yet: one email per invoice per run, however many were missed.
 */
export function dueReminder(inv: Invoice, today: string): ReminderPoint | null {
  if (inv.status !== "sent" || !EMAIL.test(inv.clientEmail.trim())) return null;
  // Strictly forward: once a reminder has gone out, anything scheduled before it is behind us and is never sent late.
  const lastSent = [...(inv.remindersSent ?? [])].sort().pop() ?? "";
  const ready = reminderSchedule(inv).filter((p) => p.on <= today && daysBetween(p.on, today) <= MISSED_REMINDER_GRACE_DAYS && p.on > lastSent);
  return ready[ready.length - 1] ?? null;
}

/** The invoice with that reminder recorded as sent. */
export const withReminderSent = (inv: Invoice, point: ReminderPoint): Invoice => ({ ...inv, remindersSent: [...(inv.remindersSent ?? []), point.on] });
/** And without it again: used when the email could not be sent after it was recorded, so tomorrow tries again. */
export const withoutReminderSent = (inv: Invoice, point: ReminderPoint): Invoice => ({ ...inv, remindersSent: (inv.remindersSent ?? []).filter((d) => d !== point.on) });

function wording(inv: Invoice, point: ReminderPoint, today: string): { subject: string; opener: string } {
  const amount = formatMoney(inv.amountCents);
  const due = formatDayLong(inv.dueOn);
  if (point.kind === "upcoming") {
    const left = Math.max(1, daysBetween(today, inv.dueOn));
    return { subject: `Invoice ${inv.number} is due ${due}`, opener: `A friendly reminder that invoice ${inv.number} (${amount}) is due on ${due}, in ${left} ${left === 1 ? "day" : "days"}.` };
  }
  if (point.kind === "due") return { subject: `Reminder: invoice ${inv.number} is due today`, opener: `A quick reminder that invoice ${inv.number} (${amount}) is due today.` };
  const late = Math.max(1, daysOverdue(inv, today));
  return late < 14
    ? { subject: `Overdue: invoice ${inv.number} (${amount})`, opener: `Invoice ${inv.number} (${amount}) was due ${due} and we have not yet received payment.` }
    : { subject: `Past due: invoice ${inv.number} (${amount})`, opener: `Invoice ${inv.number} (${amount}) is now ${late} days past its ${due} due date. Please arrange payment as soon as you can.` };
}

const PAID = "If you have already paid, thank you, and please ignore this note. If something is holding it up, just reply and tell us.";

/** The reminder email to the client, worded to fit how close or late the payment is. Replies go to the business. */
export function reminderEmail(inv: Invoice, point: ReminderPoint, today: string, o: { origin: string; business: string }): { subject: string; text: string; html: string } {
  const { subject, opener } = wording(inv, point, today);
  const who = oneLine(inv.client) || "there";
  const business = oneLine(inv.sender.name) || oneLine(o.business) || "us";
  const ways = inv.paymentMethods.map(oneLine).filter(Boolean);
  const link = `${o.origin}${invoicePath(inv)}`;
  const linkOk = link.length < 12_100; // a very long invoice cannot fit in a link; it is simply left out
  return {
    subject,
    text: [`Hi ${who},`, "", opener, ...(ways.length ? ["", `You can pay by: ${ways.join(", ")}.`] : []), ...(linkOk ? ["", `View the invoice: ${link}`] : []), "", PAID, "", "Thank you,", business].join("\n"),
    html: brandedEmail({
      preheader: opener,
      headline: `Invoice ${oneLine(inv.number)}`,
      intro: [`Hi ${who},`, opener],
      panel: [["Amount", formatMoney(inv.amountCents)], ["Due", formatDayLong(inv.dueOn)], ...(inv.description ? [["For", oneLine(inv.description)] as [string, string]] : []), ...(ways.length ? [["Pay by", ways.join(", ")] as [string, string]] : [])],
      ...(linkOk ? { buttons: [{ label: "View invoice", url: link }] } : {}),
      fine: [PAID, `Sent by AdFlo on behalf of ${business}.`],
    }),
  };
}

/** The email that delivers a brand-new invoice (when a recurring one is set to be sent automatically). */
export function newInvoiceEmail(inv: Invoice, o: { origin: string; business: string }): { subject: string; text: string; html: string } {
  const who = oneLine(inv.client) || "there";
  const business = oneLine(inv.sender.name) || oneLine(o.business) || "us";
  const intro = `Here is invoice ${inv.number}: ${formatMoney(inv.amountCents)}, due ${formatDayLong(inv.dueOn)}.`;
  const link = `${o.origin}${invoicePath(inv)}`;
  const linkOk = link.length < 12_100;
  return {
    subject: `Invoice ${inv.number} from ${business}`,
    text: [`Hi ${who},`, "", intro, ...(linkOk ? ["", `View or save it here: ${link}`] : []), "", "Thank you,", business].join("\n"),
    html: brandedEmail({
      preheader: intro,
      headline: `Invoice ${oneLine(inv.number)}`,
      intro: [`Hi ${who},`, intro],
      panel: [["Amount", formatMoney(inv.amountCents)], ["Due", formatDayLong(inv.dueOn)]],
      ...(linkOk ? { buttons: [{ label: "View invoice", url: link }] } : {}),
      fine: [`Sent by AdFlo on behalf of ${business}.`],
    }),
  };
}

/** Invoices whose next one in the series should be made today: sent or paid, the next issue date has come (and not long ago), and it does not exist yet. */
export function recurringDue(invoices: Invoice[], today: string): Invoice[] {
  return invoices
    .filter((inv) => {
      if (inv.recurrence === "none" || (inv.status !== "sent" && inv.status !== "paid")) return false;
      const next = advance(inv.issuedOn, inv.recurrence);
      return next <= today && daysBetween(next, today) <= RECURRING_CATCHUP_DAYS && !hasNextInvoice(inv, invoices);
    })
    .slice(0, MAX_CREATED_PER_WORKSPACE);
}

export type RecurringMode = "draft" | "send";

/** The next invoice for a series: a draft to approve, or already sent (only when it has an email to go to). */
export function createNextInvoice(inv: Invoice, all: Invoice[], id: string, mode: RecurringMode, today: string): Invoice | null {
  const next = nextRecurringInvoice(inv, all, id);
  if (!next) return null;
  const send = mode === "send" && EMAIL.test(next.clientEmail.trim());
  return { ...next, status: send ? "sent" : "draft", autoCreatedOn: today };
}
