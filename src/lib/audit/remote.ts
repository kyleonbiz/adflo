import { RECORDS_EVENT } from "@/lib/records/remote";
import { addEntry, type AuditEntry } from "./logic";

/** The database refused a line for good (the person may not write here), so retrying it would never help. */
export class ActivityDenied extends Error {
  constructor() { super("denied"); }
}

/** Where the activity trail lives when a database is connected. The app uses Supabase (`supabase-backend.ts`); tests use a fake. */
export interface ActivityBackend {
  /** The newest lines, newest first. */
  load(): Promise<AuditEntry[]>;
  /** Adds one line. Sending the same id again is harmless (a retry), so a line is never written twice. */
  append(entry: AuditEntry): Promise<void>;
}

type Phase = "loading" | "ready" | "failed";

const RETRY_MS = 8000;

let backend: ActivityBackend | null = null;
let configKey = "";
let epoch = 0;
let phase: Phase = "loading";
let list: AuditEntry[] = [];
/** Lines that happened but are not in the database yet, oldest first. They stay until the database has them. */
let outbox: AuditEntry[] = [];
let sending = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(RECORDS_EVENT)); };

/**
 * Starts keeping the activity trail in a database for this workspace. Calling it again for the same key does nothing.
 * Browser only: the server never holds the trail.
 */
export function configureActivity(key: string, make: () => ActivityBackend): void {
  if (typeof window === "undefined" || key === configKey) return;
  stopActivity();
  configKey = key;
  backend = make();
  phase = "loading";
  list = [];
  void load(epoch);
  notify();
}

export function stopActivity(): void {
  epoch++;
  backend = null;
  configKey = "";
  phase = "loading";
  list = [];
  outbox = [];
  sending = false;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  notify();
}

export const activityActive = (): boolean => backend !== null;
/** True while the trail has not loaded (or failed to load), so screens wait instead of flashing empty. */
export const activityLoading = (): boolean => backend !== null && phase !== "ready";
export const activityFailed = (): boolean => backend !== null && phase === "failed";
/** The trail as the screens show it (newest first), or `null` when it is not kept in a database. */
export const activityList = (): AuditEntry[] | null => (backend ? list : null);

async function load(mine: number): Promise<void> {
  if (!backend) return;
  try {
    const entries = await backend.load();
    if (mine !== epoch) return;
    // Anything that happened while the trail was loading goes on top, once.
    let next = entries;
    for (const e of outbox) if (!next.some((x) => x.id === e.id)) next = addEntry(next, e);
    list = next;
    phase = "ready";
  } catch {
    if (mine !== epoch) return;
    phase = "failed";
    scheduleRetry();
  }
  notify();
  void flush();
}

/** Records that something happened. It shows at once and is sent in the background, retried if the connection drops. */
export function appendActivity(entry: AuditEntry): void {
  if (!backend) return;
  outbox.push(entry);
  if (phase === "ready") { list = addEntry(list, entry); notify(); }
  void flush();
}

async function flush(): Promise<void> {
  if (sending || phase !== "ready" || !backend || outbox.length === 0) return;
  sending = true;
  const mine = epoch;
  try {
    while (outbox.length > 0) {
      const entry = outbox[0]!;
      try {
        await backend.append(entry);
        if (mine !== epoch) return;
        outbox.shift();
      } catch (e) {
        if (mine !== epoch) return;
        if (e instanceof ActivityDenied) { outbox.shift(); continue; } // can never be written: drop it, do not retry forever
        scheduleRetry();
        return;
      }
    }
  } finally {
    if (mine === epoch) sending = false;
  }
}

function scheduleRetry(): void {
  if (retryTimer || typeof window === "undefined") return;
  retryTimer = setTimeout(() => { retryTimer = null; retryActivity(); }, RETRY_MS);
}

/** Tries again whatever failed: reloads a trail that would not load, and re-sends lines that are not saved yet. */
export function retryActivity(): void {
  if (!backend) return;
  if (phase === "failed") { phase = "loading"; void load(epoch); notify(); }
  else void flush();
}

/** Picks up other people's lines (called when the tab is shown again). Never replaces lines that are still being sent. */
export async function refreshActivity(): Promise<void> {
  if (!backend || phase !== "ready" || outbox.length > 0) return;
  const mine = epoch;
  try {
    const entries = await backend.load();
    if (mine !== epoch || outbox.length > 0) return;
    if (JSON.stringify(entries) === JSON.stringify(list)) return;
    list = entries;
    notify();
  } catch { /* a failed refresh is silent; the next one tries again */ }
}
