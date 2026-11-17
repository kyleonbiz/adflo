import { formatDayLong } from "@/lib/dates";
import { daysOverdue, formatMoney, invoiceState } from "./logic";
import type { Invoice } from "./types";

/** A payment reminder makes sense once the invoice is sent and is due today or late. */
export function canChase(inv: Invoice, today: string): boolean {
  const s = invoiceState(inv, today);
  return s === "overdue" || s === "due_today";
}

/** The reminder to send, worded a little firmer the later the payment is. */
export function chaseEmail(inv: Invoice, today: string): { to: string; subject: string; body: string } {
  const late = daysOverdue(inv, today);
  const amount = formatMoney(inv.amountCents);
  const opener = late === 0 ? `A quick reminder that invoice ${inv.number} (${amount}) is due today.`
    : late < 14 ? `Invoice ${inv.number} (${amount}) was due ${formatDayLong(inv.dueOn)} and we have not yet received payment.`
    : `Invoice ${inv.number} (${amount}) is now ${late} days past its ${formatDayLong(inv.dueOn)} due date. Please arrange payment as soon as you can.`;
  const ways = inv.paymentMethods.length > 0 ? ["", `You can pay by: ${inv.paymentMethods.join(", ")}.`] : [];
  return {
    to: inv.clientEmail,
    subject: late === 0 ? `Reminder: invoice ${inv.number} is due today` : `Overdue: invoice ${inv.number} (${amount})`,
    body: [`Hi ${inv.client.trim() || "there"},`, "", opener, ...ways, "", "If you have already paid, thank you, and please ignore this note. If something is holding it up, reply and tell us.", "", `Thank you,`, inv.sender.name].join("\n"),
  };
}
