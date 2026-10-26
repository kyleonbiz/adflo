import { z } from "zod";
import { formatDayLong, isDay } from "@/lib/dates";
import { formatMoney } from "./logic";
import type { Invoice } from "./types";

/** The fields a client sees on a shared invoice. Reminders, recurrence and internal ids stay private. */
const sharedSchema = z.object({
  number: z.string().max(40),
  client: z.string().max(120),
  description: z.string().max(200),
  amountCents: z.number().int().min(0),
  issuedOn: z.string().refine(isDay),
  dueOn: z.string().refine(isDay),
  status: z.enum(["draft", "sent", "paid", "void"]),
  paidOn: z.string().refine(isDay).nullable(),
  notes: z.string().max(1000),
});
export type SharedInvoice = z.infer<typeof sharedSchema>;

const toBase64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** The invoice packed into a URL-safe token, so a plain link carries everything the page needs. */
export function encodeInvoice(inv: Invoice): string {
  const { number, client, description, amountCents, issuedOn, dueOn, status, paidOn, notes } = inv;
  return toBase64Url(JSON.stringify({ number, client, description, amountCents, issuedOn, dueOn, status, paidOn, notes }));
}

export function decodeInvoice(token: string): SharedInvoice | null {
  if (!/^[A-Za-z0-9_-]{1,8000}$/.test(token)) return null;
  try {
    const parsed = sharedSchema.safeParse(JSON.parse(fromBase64Url(token)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A `mailto:` link that opens the user's email app with the invoice message and link filled in. */
export function invoiceMailto(inv: Invoice, origin: string): string {
  const subject = `Invoice ${inv.number} from AdFlo`;
  const body = [
    `Hi ${inv.client},`,
    "",
    `Here is invoice ${inv.number}${inv.description ? ` for ${inv.description}` : ""}: ${formatMoney(inv.amountCents)}, due ${formatDayLong(inv.dueOn)}.`,
    "",
    `View or save it here: ${origin}${invoicePath(inv)}`,
    "",
    "Thank you!",
  ].join("\r\n");
  return `mailto:${encodeURIComponent(inv.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const invoicePath = (inv: Invoice) => `/invoice/${encodeInvoice(inv)}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const STATUS = { draft: "Draft", sent: "Awaiting payment", paid: "Paid", void: "Void" } as const;

/** A standalone, plain HTML copy of the invoice, for saving to a computer. */
export function invoiceHtml(inv: SharedInvoice): string {
  const row = (k: string, v: string) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(inv.number)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem;color:#111}
h1{font-size:1.5rem;margin:0}th{text-align:left;font-weight:500;color:#555;padding:.35rem 1.5rem .35rem 0}td{padding:.35rem 0}
.amount{font-size:2rem;font-weight:600;margin:1rem 0}</style></head><body>
<h1>Invoice ${esc(inv.number)}</h1>
<p>${esc(inv.client)}${inv.description ? ` · ${esc(inv.description)}` : ""}</p>
<p class="amount">${esc(formatMoney(inv.amountCents))}</p>
<table>${row("Status", STATUS[inv.status])}${row("Issued", formatDayLong(inv.issuedOn))}${row("Due", formatDayLong(inv.dueOn))}${inv.paidOn ? row("Paid", formatDayLong(inv.paidOn)) : ""}</table>
${inv.notes ? `<p>${esc(inv.notes)}</p>` : ""}
</body></html>
`;
}
