import type { Invoice } from "@/lib/invoices/types";

/** A well-formed billing invoice: the same check the browser copy has always used, so a damaged record can never break a page. */
export function isBillingInvoice(r: unknown): r is Invoice {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return typeof o.id === "string" && o.id.length > 0 && o.id.length <= 80 && typeof o.number === "string" && typeof o.client === "string"
    && Array.isArray(o.items) && o.items.length > 0 && typeof o.amountCents === "number" && Number.isFinite(o.amountCents)
    && ["draft", "sent", "paid", "void"].includes(o.status as string) && typeof o.issuedOn === "string" && typeof o.dueOn === "string"
    && !!o.sender && typeof o.sender === "object";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The row for one invoice: its id, the client it is for (when that is a real client), and the invoice itself. */
export const toRow = (i: Invoice) => ({ id: i.id, client_id: typeof i.clientId === "string" && UUID.test(i.clientId) ? i.clientId.toLowerCase() : null, data: i });

/** What changed between two lists, by invoice: those added or edited, and the ids removed. Order does not matter. */
export function diffInvoices(before: Invoice[], after: Invoice[]): { upsert: Invoice[]; remove: string[] } {
  const was = new Map(before.map((i) => [i.id, JSON.stringify(i)]));
  const upsert = after.filter((i) => was.get(i.id) !== JSON.stringify(i));
  const keep = new Set(after.map((i) => i.id));
  return { upsert, remove: before.filter((i) => !keep.has(i.id)).map((i) => i.id) };
}

/** Most changes one request may carry. */
export const MAX_CHANGES = 200;
