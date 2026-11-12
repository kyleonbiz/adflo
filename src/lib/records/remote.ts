import { diffRecords, sameRecords, type Rec } from "./diff";
import type { RecordKind } from "./storage";

/** Fired whenever saved records or the sync state change; `useSyncExternalStore` listens to it. */
export const RECORDS_EVENT = "adflo-records-change";

/** Why a save did not go through: no permission (a viewer), or a problem worth retrying (network, server). */
export type SyncProblem = "denied" | "failed";
export class RecordsSyncError extends Error {
  constructor(readonly problem: SyncProblem) { super(problem); }
}

/** Where saved records live. The app uses Supabase (`supabase-backend.ts`); tests use a fake. */
export interface RecordsBackend {
  /** `saved` is false when this service has never saved anything (so starter records may show). */
  load(kind: RecordKind): Promise<{ records: Rec[]; saved: boolean }>;
  save(kind: RecordKind, change: { upserts: Rec[]; deletes: string[]; markSaved: boolean }): Promise<void>;
}

interface KindState {
  phase: "loading" | "ready" | "failed";
  /** What the screens show: null means the service has never saved anything. */
  list: Rec[] | null;
  /** What the database is known to hold. */
  synced: Rec[] | null;
  saved: boolean;
  problem: SyncProblem | null;
  chain: Promise<void>;
}

const RETRY_MS = 8000;

let backend: RecordsBackend | null = null;
let configKey = "";
let epoch = 0;
const states = new Map<RecordKind, KindState>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(RECORDS_EVENT)); };

/**
 * Starts saving the given services to a database for this workspace. Calling it again for the same key does nothing,
 * so a re-render can never reload or duplicate anything. Browser only: the server never holds records.
 */
export function configureRemote(key: string, make: () => RecordsBackend, kinds: readonly RecordKind[]): void {
  if (typeof window === "undefined" || key === configKey) return;
  stopRemote();
  configKey = key;
  backend = make();
  const mine = epoch;
  for (const kind of kinds) {
    states.set(kind, { phase: "loading", list: null, synced: null, saved: false, problem: null, chain: Promise.resolve() });
    void load(kind, mine);
  }
  notify();
}

export function stopRemote(): void {
  epoch++;
  backend = null;
  configKey = "";
  states.clear();
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  notify();
}

export const isRemote = (kind: RecordKind): boolean => states.has(kind);
export const remoteList = (kind: RecordKind): Rec[] | null => states.get(kind)?.list ?? null;
/** True while any database-backed service has not loaded (or failed to load), so screens wait instead of flashing empty. */
export const remoteLoading = (): boolean => [...states.values()].some((s) => s.phase !== "ready");
export const remoteActive = (): boolean => states.size > 0;
/** The first save or load problem, for the banner. */
export function remoteProblem(): { problem: SyncProblem; loading: boolean } | null {
  for (const s of states.values()) {
    if (s.phase === "failed") return { problem: "failed", loading: true };
    if (s.problem) return { problem: s.problem, loading: false };
  }
  return null;
}

async function load(kind: RecordKind, mine: number): Promise<void> {
  const s = states.get(kind);
  if (!s || !backend) return;
  try {
    const res = await backend.load(kind);
    if (mine !== epoch) return;
    s.list = res.saved ? res.records : null;
    s.synced = s.list;
    s.saved = res.saved;
    s.phase = "ready";
    s.problem = null;
  } catch {
    if (mine !== epoch) return;
    s.phase = "failed"; // never edit on top of a copy we could not read: that could overwrite newer work
    scheduleRetry();
  }
  notify();
}

/** Replaces a service's records. The screens see the change at once; the database follows in the background. */
export function remoteWrite(kind: RecordKind, list: Rec[]): void {
  const s = states.get(kind);
  if (!s || s.phase !== "ready") return; // still loading or failed: nothing safe to save on top of
  s.list = list;
  notify();
  persist(kind);
}

function persist(kind: RecordKind): void {
  const s = states.get(kind);
  if (!s) return;
  const mine = epoch;
  s.chain = s.chain.then(async () => {
    if (mine !== epoch || !backend || !s.list) return;
    const list = s.list;
    const change = diffRecords(s.synced, list);
    const markSaved = !s.saved;
    if (change.upserts.length === 0 && change.deletes.length === 0 && !markSaved) { if (s.problem) { s.problem = null; notify(); } return; }
    try {
      await backend.save(kind, { ...change, markSaved });
      if (mine !== epoch) return;
      s.synced = list;
      s.saved = true;
      s.problem = null;
    } catch (e) {
      if (mine !== epoch) return;
      s.problem = e instanceof RecordsSyncError ? e.problem : "failed";
      if (s.problem === "denied") s.list = s.synced; // not allowed to change this: show what is really saved
      else scheduleRetry();
    }
    notify();
  });
}

function scheduleRetry(): void {
  if (retryTimer || typeof window === "undefined") return;
  retryTimer = setTimeout(() => { retryTimer = null; retryRemote(); }, RETRY_MS);
}

/** Tries again whatever failed: reloads a service that would not load, and re-sends unsaved changes. */
export function retryRemote(): void {
  const mine = epoch;
  for (const [kind, s] of states) {
    if (s.phase === "failed") { s.phase = "loading"; void load(kind, mine); notify(); }
    else if (s.problem === "failed") persist(kind);
  }
}

/** Picks up other people's changes (called when the tab is shown again). Never overwrites what you have not saved yet. */
export async function refreshRemote(): Promise<void> {
  const mine = epoch;
  for (const [kind, s] of states) {
    if (s.phase !== "ready" || s.problem || !backend) continue;
    if (!sameRecords(s.list, s.synced)) continue; // unsaved changes of your own win
    try {
      const res = await backend.load(kind);
      if (mine !== epoch || !sameRecords(s.list, s.synced)) continue;
      const fresh = res.saved ? res.records : null;
      if (sameRecords(fresh, s.synced)) continue;
      s.list = s.synced = fresh;
      s.saved = res.saved;
      notify();
    } catch { /* a failed refresh is silent; the next one tries again */ }
  }
}
