import { addDays } from "@/lib/dates";
import { describeItems, generateInvoiceNumber, invoiceTotals } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { effectivePriceCents, type ClientRecord, type Plan } from "./types";

/**
 * The Control center bills AdFlo's own clients with the same invoices the client app uses (items, tax, a link the
 * client can open, download, send, reminders). Records live in the browser for now: no payment processor, no table.
 */
export const ADFLO_SENDER = { fromName: "AdFlo", fromAddress: "", fromPhone: "", fromEmail: "billing@adflo.pro", paymentMethods: "Bank transfer\nCheck" } as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

const sender = { name: ADFLO_SENDER.fromName, address: ADFLO_SENDER.fromAddress, phone: ADFLO_SENDER.fromPhone, email: ADFLO_SENDER.fromEmail };

/** One subscription invoice as a draft: a single line, due in two weeks. */
function draftInvoice(c: Pick<ClientRecord, "id" | "name" | "ownerEmail">, description: string, cents: number, today: string, number: string, id: string): Invoice {
  const items = [{ description, qty: 1, rateCents: cents }];
  return {
    id, number, clientId: c.id, client: c.name, clientEmail: c.ownerEmail, description: describeItems(items), items, taxRate: 0, sender,
    paymentMethods: ADFLO_SENDER.paymentMethods.split("\n"), amountCents: invoiceTotals(items, 0).totalCents, issuedOn: today, dueOn: addDays(today, 14),
    status: "draft", paidOn: null, recurrence: "none", reminderDays: [7, 1], notes: "Thank you for choosing AdFlo. Questions about this invoice? Just reply to the email.",
  };
}

/**
 * Drafts for this month's subscriptions: one per ACTIVE client with a price, skipping any client that already
 * has an invoice for the month (voided ones do not count). Trials, paused and cancelled clients are not billed.
 */
export function monthlyDrafts(clients: ClientRecord[], plans: Plan[], existing: Invoice[], today: string): Invoice[] {
  const label = monthLabel(today);
  const out: Invoice[] = [];
  for (const c of clients) {
    if (c.status !== "active") continue;
    const cents = effectivePriceCents(c, plans);
    if (!cents || cents <= 0) continue;
    const line = `AdFlo ${c.plan} · ${label}`;
    if (existing.some((i) => i.clientId === c.id && i.status !== "void" && i.items.some((it) => it.description === line))) continue;
    out.push(draftInvoice(c, line, cents, today, generateInvoiceNumber(today, [...existing, ...out].map((i) => i.number)), `inv-${c.id}-${today.slice(0, 7)}`));
  }
  return out;
}

/** What "New invoice" for one client starts with: their name, owner email and monthly price. */
export function clientDraft(c: ClientRecord, plans: Plan[], today: string) {
  const cents = effectivePriceCents(c, plans);
  return { client: c.name, clientEmail: c.ownerEmail, description: `AdFlo ${c.plan} · ${monthLabel(today)}`, ...(cents ? { amount: (cents / 100).toFixed(2) } : {}) };
}

/** Labelled examples shown in the preview before anything is saved. */
export const SAMPLE_INVOICES = (today: string): Invoice[] => {
  const acme = { id: "sample-1", name: "Sample: Acme Roofing", ownerEmail: "pat@example.com" };
  const paid: Invoice = { ...draftInvoice(acme, `AdFlo standard · ${monthLabel(addDays(today, -35))}`, 9900, addDays(today, -35), "INV-261001-1001", "s-1"), status: "paid", paidOn: addDays(today, -18) };
  const sent: Invoice = { ...draftInvoice(acme, `AdFlo standard · ${monthLabel(today)}`, 9900, addDays(today, -5), "INV-261002-1002", "s-2"), status: "sent" };
  const late: Invoice = { ...draftInvoice({ id: "sample-2", name: "Sample: Birch & Co", ownerEmail: "sam@example.com" }, "Setup and onboarding", 25000, addDays(today, -30), "INV-261003-1003", "s-3"), status: "sent" };
  return [paid, sent, late];
};

/** Invoices saved by the earlier Control center screen (one amount, no items) become single-line invoices. */
export function fromLegacy(o: Record<string, unknown>): Invoice | null {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  if (typeof o.id !== "string" || typeof o.amountCents !== "number" || !Number.isInteger(o.amountCents) || o.amountCents <= 0) return null;
  if (!["draft", "sent", "paid", "void"].includes(o.status as string)) return null;
  const base = draftInvoice({ id: str(o.clientId, 80), name: str(o.clientName, 120), ownerEmail: "" }, str(o.description, 200) || "Invoice", o.amountCents, str(o.issuedOn, 10), str(o.number, 20), str(o.id, 80));
  return { ...base, dueOn: str(o.dueOn, 10), status: o.status as Invoice["status"], paidOn: typeof o.paidOn === "string" ? o.paidOn.slice(0, 10) : null, notes: str(o.note, 500) };
}
