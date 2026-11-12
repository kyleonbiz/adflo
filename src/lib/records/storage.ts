import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Rec } from "./diff";
import { RECORDS_EVENT, isRemote, remoteActive, remoteList, remoteLoading, remoteProblem, remoteWrite, type SyncProblem } from "./remote";

/**
 * The services that keep records. In the preview (no database) they live in this browser, each under its own key.
 * With a database connected, the services listed in `PERSISTED_KINDS` are saved to the workspace instead
 * (see `remote.ts`); the rest stay in the browser until they are moved over.
 */
export type RecordKind = "invoices" | "licenses" | "vendors" | "contacts" | "projects";

const key = (kind: RecordKind) => `adflo.records.${kind}.v1`;
const EVENT = RECORDS_EVENT;

// If browser storage is blocked, records still last for the page's lifetime.
const memory = new Map<RecordKind, string>();

/** Stringifying a long list on every render is wasteful, so each list is stringified once. */
const stringified = new WeakMap<object, string>();

export function readRaw(kind: RecordKind): string {
  if (isRemote(kind)) {
    const list = remoteList(kind);
    if (!list) return ""; // not loaded yet, or never saved
    let raw = stringified.get(list);
    if (raw === undefined) { raw = JSON.stringify(list); stringified.set(list, raw); }
    return raw;
  }
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
  if (isRemote(kind)) { remoteWrite(kind, list as unknown as Rec[]); return; }
  const raw = JSON.stringify(list);
  memory.set(kind, raw);
  try { window.localStorage.setItem(key(kind), raw); } catch { /* kept in memory */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Forgets a service's saved records, so it starts blank again. */
export function clearRecords(kind: RecordKind): void {
  if (isRemote(kind)) return; // records in the database are never wiped by a helper
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

/** True while saved records are still loading from the database, so a page shows its skeleton, not an empty list. */
export function useRecordsLoading(): boolean {
  return useSyncExternalStore(subscribe, remoteLoading, () => false);
}

/** True when this workspace's records are saved to a database (the sample-data tools must stay away from them). */
export function useRecordsInDatabase(): boolean {
  return useSyncExternalStore(subscribe, remoteActive, () => false);
}

/** The first problem loading or saving records, if any: for the banner. */
export function useRecordsProblem(): { problem: SyncProblem; loading: boolean } | null {
  const key = useSyncExternalStore(subscribe, () => { const p = remoteProblem(); return p ? `${p.problem}:${p.loading}` : ""; }, () => "");
  return useMemo(() => (key ? { problem: key.split(":")[0] as SyncProblem, loading: key.endsWith("true") } : null), [key]);
}
