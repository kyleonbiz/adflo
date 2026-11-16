import { useCallback, useMemo, useSyncExternalStore } from "react";
import { activityFailed, activityLoading } from "@/lib/audit/remote";
import type { Rec } from "./diff";
import { RECORDS_EVENT, isRemote, remoteActive, remoteList, remoteLoading, remoteProblem, remoteWrite, type SyncProblem } from "./remote";

/**
 * The services that keep records. In the preview (no database) they live in this browser, each under its own key.
 * With a database connected, the services listed in `PERSISTED_KINDS` are saved to the workspace instead
 * (see `remote.ts`); the rest stay in the browser until they are moved over.
 */
export type RecordKind =
  | "invoices" | "licenses" | "vendors" | "contacts" | "projects"
  | "todos" | "reminders" | "signing" | "packets" | "schedules" | "projecttypes"
  | "settings" | "setup" | "chains";

/**
 * The browser key each service used before the database existed. They keep it, so what is already saved in a browser
 * (and what the preview saves) is still read. The first five were always kept under `adflo.records.<service>.v1`.
 */
const LOCAL_KEYS: Partial<Record<RecordKind, string>> = {
  todos: "adflo.todos.v1",
  reminders: "adflo.reminders.v1",
  signing: "adflo.signing.v1",
  packets: "adflo.packets.v1",
  schedules: "adflo.scheduled-reports.v1",
  projecttypes: "adflo.project-types.v1",
  settings: "adflo.settings.v1",
  setup: "aurum.setup.v1",
  chains: "adflo.approval-chains.v1",
};
const key = (kind: RecordKind) => LOCAL_KEYS[kind] ?? `adflo.records.${kind}.v1`;
const EVENT = RECORDS_EVENT;

/** In the database a single-object service (settings, setup answers, approval chains) is one record with this id. */
export const SINGLE_ID = "config";

// If browser storage is blocked, records still last for the page's lifetime.
const memory = new Map<RecordKind, string>();

/** Stringifying a long list on every render is wasteful, so each list is stringified once. */
const stringified = new WeakMap<object, string>();

function readLocal(kind: RecordKind): string {
  try {
    const v = window.localStorage.getItem(key(kind));
    if (v !== null) return v;
  } catch { /* storage unavailable: fall back to memory */ }
  return memory.get(kind) ?? "";
}

function writeLocal(kind: RecordKind, raw: string): void {
  memory.set(kind, raw);
  try { window.localStorage.setItem(key(kind), raw); } catch { /* kept in memory */ }
  window.dispatchEvent(new Event(EVENT));
}

export function readRaw(kind: RecordKind): string {
  if (isRemote(kind)) {
    const list = remoteList(kind);
    if (!list) return ""; // not loaded yet, or never saved
    let raw = stringified.get(list);
    if (raw === undefined) { raw = JSON.stringify(list); stringified.set(list, raw); }
    return raw;
  }
  return readLocal(kind);
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
  writeLocal(kind, JSON.stringify(list));
}

/**
 * A single-object service (settings, setup answers, approval chains) keeps one object, not a list. In this browser
 * that is the object as JSON; in the database it is one record with the id `SINGLE_ID`. `readSingleRaw` gives the
 * object as JSON in both cases ("" when nothing is saved yet), so each service keeps its own validation.
 */
export function readSingleRaw(kind: RecordKind): string {
  if (!isRemote(kind)) return readLocal(kind);
  const rec = remoteList(kind)?.find((r) => r.id === SINGLE_ID);
  if (!rec) return ""; // not loaded yet, or never saved
  let raw = stringified.get(rec);
  if (raw === undefined) { raw = JSON.stringify(Object.fromEntries(Object.entries(rec).filter(([k]) => k !== "id"))); stringified.set(rec, raw); }
  return raw;
}

export function writeSingle(kind: RecordKind, value: object): void {
  if (isRemote(kind)) { remoteWrite(kind, [{ ...value, id: SINGLE_ID }] as Rec[]); return; }
  writeLocal(kind, JSON.stringify(value));
}

/** Forgets the saved object. In the database that deletes its record (a service's "start over" is the owner's own choice). */
export function clearSingle(kind: RecordKind): void {
  if (isRemote(kind)) { remoteWrite(kind, []); return; }
  memory.delete(kind);
  try { window.localStorage.removeItem(key(kind)); } catch { /* nothing to remove */ }
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

/** A service's saved list as the JSON it is stored as ("" when nothing is saved), for services that validate it themselves. */
export function useRecordsRaw(kind: RecordKind): string {
  return useSyncExternalStore(subscribe, () => readRaw(kind), () => "");
}

/** A single-object service's saved object as JSON ("" when nothing is saved). */
export function useSingleRaw(kind: RecordKind): string {
  return useSyncExternalStore(subscribe, () => readSingleRaw(kind), () => "");
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

/** True while saved records (or the activity trail) are still loading from the database, so a page shows its skeleton, not an empty list. */
export function useRecordsLoading(): boolean {
  return useSyncExternalStore(subscribe, () => remoteLoading() || activityLoading(), () => false);
}

/** True when this workspace's records are saved to a database (the sample-data tools must stay away from them). */
export function useRecordsInDatabase(): boolean {
  return useSyncExternalStore(subscribe, remoteActive, () => false);
}

/** The first problem loading or saving records, if any: for the banner. */
export function useRecordsProblem(): { problem: SyncProblem; loading: boolean } | null {
  const key = useSyncExternalStore(subscribe, () => {
    const p = remoteProblem() ?? (activityFailed() ? { problem: "failed" as const, loading: true } : null);
    return p ? `${p.problem}:${p.loading}` : "";
  }, () => "");
  return useMemo(() => (key ? { problem: key.split(":")[0] as SyncProblem, loading: key.endsWith("true") } : null), [key]);
}
