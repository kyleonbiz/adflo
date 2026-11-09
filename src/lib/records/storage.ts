import { useCallback, useMemo, useSyncExternalStore } from "react";

/** The services that keep their records in this browser, and the key each one is stored under. */
export type RecordKind = "invoices" | "licenses" | "vendors" | "contacts" | "projects";

const key = (kind: RecordKind) => `adflo.records.${kind}.v1`;
const EVENT = "adflo-records-change";

// If browser storage is blocked, records still last for the page's lifetime.
const memory = new Map<RecordKind, string>();

export function readRaw(kind: RecordKind): string {
  try {
    const v = window.localStorage.getItem(key(kind));
    if (v !== null) return v;
  } catch { /* storage unavailable: fall back to memory */ }
  return memory.get(kind) ?? "";
}

/** Parses what was stored; `null` means nothing has been saved yet (or it was unreadable). */
export function parseRecords<T>(raw: string): T[] | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch { return null; }
}

export function writeRecords<T>(kind: RecordKind, list: T[]): void {
  const raw = JSON.stringify(list);
  memory.set(kind, raw);
  try { window.localStorage.setItem(key(kind), raw); } catch { /* kept in memory */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Forgets a service's saved records, so it starts blank again. */
export function clearRecords(kind: RecordKind): void {
  memory.delete(kind);
  try { window.localStorage.removeItem(key(kind)); } catch { /* nothing to remove */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The saved records of one service, or `null` when none were ever saved. `null` on the server. */
export function useStoredRecords<T>(kind: RecordKind): T[] | null {
  const raw = useSyncExternalStore(subscribe, () => readRaw(kind), () => "");
  return useMemo(() => parseRecords<T>(raw), [raw]);
}

/** Like `useState` for a service's records, but saved in this browser and shared across pages and tabs. */
export function useRecordsState<T>(kind: RecordKind): [T[] | null, (next: T[] | ((prev: T[] | null) => T[])) => void] {
  const stored = useStoredRecords<T>(kind);
  const set = useCallback((next: T[] | ((prev: T[] | null) => T[])) => {
    writeRecords(kind, typeof next === "function" ? next(parseRecords<T>(readRaw(kind))) : next);
  }, [kind]);
  return [stored, set];
}
