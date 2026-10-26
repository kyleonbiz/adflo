import { z } from "zod";
import { isDay } from "@/lib/dates";
import { formatMoney, invoiceTotals, lineCents } from "./logic";
import type { Invoice } from "./types";

/** The fields a client sees on a shared invoice. Reminders, recurrence and internal ids stay private. */
const sharedSchema = z.object({
  number: z.string().max(40),
  client: z.string().max(120),
  clientEmail: z.string().max(254),
  items: z.array(z.object({
    description: z.string().max(200),
    qty: z.number().positive().max(100_000),
    rateCents: z.number().int().min(0),
  })).min(1).max(50),
  taxRate: z.number().min(0).max(100),
  sender: z.object({ name: z.string().max(120), address: z.string().max(200), phone: z.string().max(40), email: z.string().max(254) }),
  paymentMethods: z.array(z.string().max(120)).max(6),
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
  const { number, client, clientEmail, items, taxRate, sender, paymentMethods, issuedOn, dueOn, status, paidOn, notes } = inv;
  return toBase64Url(JSON.stringify({ number, client, clientEmail, items, taxRate, sender, paymentMethods, issuedOn, dueOn, status, paidOn, notes }));
}

export function decodeInvoice(token: string): SharedInvoice | null {
  if (!/^[A-Za-z0-9_-]{1,12000}$/.test(token)) return null;
  try {
    const parsed = sharedSchema.safeParse(JSON.parse(fromBase64Url(token)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A `mailto:` link that opens the user's email app with the invoice message and link filled in. */
export function invoiceMailto(inv: Invoice, origin: string): string {
  const subject = `Invoice ${inv.number} from ${inv.sender.name}`;
  const body = [
    `Hi ${inv.client},`,
    "",
    `Here is invoice ${inv.number}: ${formatMoney(inv.amountCents)}, due ${inv.dueOn}.`,
    "",
    `View or save it here: ${origin}${invoicePath(inv)}`,
    "",
    "Thank you!",
  ].join("\r\n");
  return `mailto:${encodeURIComponent(inv.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const invoicePath = (inv: Invoice) => `/invoice/${encodeInvoice(inv)}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const STATUS = { draft: "Draft", sent: "Sent", paid: "Paid", void: "Void" } as const;

/** Styles for the plain invoice layout; everything is scoped under `.inv`. */
export const INVOICE_CSS = `
.inv{font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;max-width:60rem;margin:0 auto;padding:2rem 1.5rem}
.inv .top{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;padding-bottom:1rem;border-bottom:1px solid #d4d4d8}
.inv h1{font-size:1.9rem;font-weight:800;letter-spacing:-.01em;margin:0}
.inv .muted{color:#6b7280;font-size:.85rem}
.inv .right{text-align:right}
.inv .num{color:#16a34a;font-size:1.25rem;font-weight:700}
.inv .pill{display:inline-block;background:#f3f4f6;border-radius:999px;padding:.05rem .6rem;font-size:.75rem;margin-top:.35rem}
.inv .parties{display:flex;flex-wrap:wrap;gap:2rem 3rem;margin:1.5rem 0}
.inv .label{font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin-bottom:.3rem}
.inv table{width:100%;border-collapse:collapse;margin:1rem 0}
.inv th{background:#f3f4f6;text-align:left;font-size:.8rem;padding:.55rem .6rem}
.inv td{padding:.55rem .6rem;border-bottom:1px solid #e5e7eb}
.inv .n{text-align:right;font-variant-numeric:tabular-nums}
.inv .totals{margin-left:auto;width:16rem}
.inv .totals div{display:flex;justify-content:space-between;padding:.2rem 0;font-variant-numeric:tabular-nums}
.inv .totals .grand{border-top:2px solid #111;margin-top:.4rem;padding-top:.5rem;font-weight:700;font-size:1.05rem}
.inv .extra{margin-top:1.75rem}
.inv .extra p,.inv .extra ul{margin:.15rem 0}
.inv .extra ul{padding-left:1.1rem}
`;

/** The invoice markup alone (no `<html>`), laid out as a plain printed invoice. */
export function invoiceBodyHtml(inv: SharedInvoice): string {
  const { subtotalCents, taxCents, totalCents } = invoiceTotals(inv.items, inv.taxRate);
  const lines = (...parts: string[]) => parts.filter(Boolean).map((p) => `<div>${esc(p)}</div>`).join("");
  const rows = inv.items
    .map((i) => `<tr><td>${esc(i.description)}</td><td class="n">${i.qty}</td><td class="n">${formatMoney(i.rateCents)}</td><td class="n">${formatMoney(lineCents(i))}</td></tr>`)
    .join("");
  return `<div class="inv">
<div class="top"><div><h1>INVOICE</h1><div class="muted">${esc(inv.sender.name)}</div></div>
<div class="right"><div class="num">${esc(inv.number)}</div><div class="muted">Issue Date: ${inv.issuedOn}</div><div class="muted">Due Date: ${inv.dueOn}</div><span class="pill">${STATUS[inv.status]}</span></div></div>
<div class="parties"><div><div class="label">From</div>${lines(inv.sender.name, inv.sender.address, inv.sender.phone, inv.sender.email)}</div>
<div><div class="label">Bill to</div>${lines(inv.client, inv.clientEmail)}</div></div>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>Subtotal</span><span>${formatMoney(subtotalCents)}</span></div>${inv.taxRate > 0 ? `<div><span>Tax (${inv.taxRate}%)</span><span>${formatMoney(taxCents)}</span></div>` : ""}<div class="grand"><span>Total</span><span>${formatMoney(totalCents)}</span></div></div>
${inv.paymentMethods.length ? `<div class="extra"><div class="label">Payment</div><p>Please pay by ${inv.dueOn}.</p><ul>${inv.paymentMethods.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
${inv.paidOn ? `<div class="extra"><p>Paid on ${inv.paidOn}.</p></div>` : ""}
${inv.notes ? `<div class="extra"><div class="label">Notes</div><p style="white-space:pre-line">${esc(inv.notes)}</p></div>` : ""}
</div>`;
}

/** A standalone HTML file of the invoice, for saving to a computer. */
export function invoiceHtml(inv: SharedInvoice): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(inv.number)}</title>
<style>body{margin:0;background:#fff}${INVOICE_CSS}</style></head><body>
${invoiceBodyHtml(inv)}
</body></html>
`;
}
