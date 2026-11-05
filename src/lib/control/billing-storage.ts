import { useSyncExternalStore } from "react";
import { INVOICE_STATUSES, type BillingInvoice } from "./billing";

const KEY = "adflo.control.invoices";
const EVENT = "adflo-control-invoices";
const EMPTY: BillingInvoice[] = [];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Keeps only well-formed records, so a damaged or hand-edited entry can never break the page. */
function parse(raw: string | null): BillingInvoice[] | null {
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    return data.flatMap((r): BillingInvoice[] => {
      if (!r || typeof r !== "object") return [];
      const o = r as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.amountCents !== "number" || !Number.isInteger(o.amountCents) || o.amountCents <= 0) return [];
      if (!INVOICE_STATUSES.includes(o.status as BillingInvoice["status"])) return [];
      return [{
        id: str(o.id, 80), number: str(o.number, 20), clientId: str(o.clientId, 80), clientName: str(o.clientName, 120), description: str(o.description, 200),
        amountCents: o.amountCents, issuedOn: str(o.issuedOn, 10), dueOn: str(o.dueOn, 10), status: o.status as BillingInvoice["status"],
        paidOn: typeof o.paidOn === "string" ? o.paidOn.slice(0, 10) : null, method: str(o.method, 40), note: str(o.note, 500),
      }];
    });
  } catch { return EMPTY; }
}

let cachedRaw: string | null | undefined;
let cached: BillingInvoice[] | null = null;

/** Same array object until the stored text changes (required by useSyncExternalStore). */
function read(): BillingInvoice[] | null {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* blocked: treat as never saved */ }
  if (raw !== cachedRaw) { cachedRaw = raw; cached = parse(raw); }
  return cached;
}

export function saveInvoices(list: BillingInvoice[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked: this session only */ }
  cachedRaw = undefined; // force a re-read; falls back to the in-memory copy below when storage is blocked
  memory = list;
  window.dispatchEvent(new Event(EVENT));
}
let memory: BillingInvoice[] | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Saved invoices; null when none were ever saved here (the caller decides what an untouched start looks like). */
export function useSavedInvoices(): BillingInvoice[] | null {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  return stored ?? memory;
}
