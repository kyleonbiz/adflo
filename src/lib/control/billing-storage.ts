import { useSyncExternalStore } from "react";
import type { Invoice } from "@/lib/invoices/types";
import { fromLegacy } from "./billing";

const KEY = "adflo.control.invoices.v2";
const LEGACY_KEY = "adflo.control.invoices";
const EVENT = "adflo-control-invoices";
const EMPTY: Invoice[] = [];

/** Keeps only well-formed records, so a damaged or hand-edited entry can never break the page. */
function parse(raw: string | null, legacy: boolean): Invoice[] | null {
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    return data.flatMap((r): Invoice[] => {
      if (!r || typeof r !== "object") return [];
      const o = r as Record<string, unknown>;
      if (legacy) { const i = fromLegacy(o); return i ? [i] : []; }
      const ok = typeof o.id === "string" && typeof o.number === "string" && typeof o.client === "string" && Array.isArray(o.items) && o.items.length > 0
        && typeof o.amountCents === "number" && ["draft", "sent", "paid", "void"].includes(o.status as string)
        && typeof o.issuedOn === "string" && typeof o.dueOn === "string" && !!o.sender && typeof o.sender === "object";
      return ok ? [r as Invoice] : [];
    });
  } catch { return EMPTY; }
}

let cachedRaw: string | null | undefined;
let cached: Invoice[] | null = null;
let memory: Invoice[] | null = null;

/** Same array object until the stored text changes (required by useSyncExternalStore). */
function read(): Invoice[] | null {
  let raw: string | null = null, legacy = false;
  try {
    raw = window.localStorage.getItem(KEY);
    if (raw === null) { raw = window.localStorage.getItem(LEGACY_KEY); legacy = raw !== null; }
  } catch { /* blocked: treat as never saved */ }
  const tagged = raw === null ? null : `${legacy ? "L" : "V"}${raw}`;
  if (tagged !== cachedRaw) { cachedRaw = tagged; cached = parse(raw, legacy); }
  return cached;
}

export function saveInvoices(list: Invoice[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked: this session only */ }
  cachedRaw = undefined;
  memory = list;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Saved invoices; null when none were ever saved here (the caller decides what an untouched start looks like). */
export function useSavedInvoices(): Invoice[] | null {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  return stored ?? memory;
}
