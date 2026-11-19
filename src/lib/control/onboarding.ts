import { CHECKLIST_STEPS, type ClientRecord } from "./types";

/** A client left this long without finishing setup is flagged as stalled. */
export const STALLED_AFTER_DAYS = 7;
/** A client who started within this many days and has not finished onboarding is "new": it sits in the New area until it is done. */
export const NEW_CLIENT_DAYS = 14;

export interface OnboardingRow {
  client: ClientRecord;
  done: number;
  total: number;
  /** The first step not done yet, or null when every step is. */
  next: string | null;
  complete: boolean;
  daysSinceStart: number;
  stalled: boolean;
  /** Recently started, on trial or active, and not fully set up: needs addressing now. */
  isNew: boolean;
}

/** Whole days from `from` (YYYY-MM-DD or a timestamp) to `today` (YYYY-MM-DD). Never negative. */
export function daysBetween(from: string | null, today: string): number {
  if (!from) return 0;
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.max(0, Math.round((b - a) / 86_400_000));
}

export function onboardingRow(client: ClientRecord, today: string): OnboardingRow {
  const total = CHECKLIST_STEPS.length;
  const done = CHECKLIST_STEPS.filter((s) => client.checklist.includes(s.key)).length;
  const next = CHECKLIST_STEPS.find((s) => !client.checklist.includes(s.key))?.label ?? null;
  const complete = next === null;
  const daysSinceStart = daysBetween(client.startedOn ?? client.createdAt, today);
  const live = client.status === "trial" || client.status === "active";
  return { client, done, total, next, complete, daysSinceStart, stalled: !complete && daysSinceStart >= STALLED_AFTER_DAYS, isNew: live && !complete && daysSinceStart < NEW_CLIENT_DAYS };
}

/**
 * Every client who is in service or on trial. Suspended and cancelled clients are left out: they are not being set up.
 * Stalled and least-finished come first, so the ones that need a nudge are at the top.
 */
export function onboardingRows(clients: ClientRecord[], today: string): OnboardingRow[] {
  return clients
    .filter((c) => c.status === "trial" || c.status === "active")
    .map((c) => onboardingRow(c, today))
    .sort((a, b) => Number(b.stalled) - Number(a.stalled) || Number(a.complete) - Number(b.complete) || a.done - b.done || a.client.name.localeCompare(b.client.name));
}

export interface OnboardingSummary { inProgress: number; stalled: number; complete: number; notStarted: number }

export function summarizeOnboarding(rows: OnboardingRow[]): OnboardingSummary {
  return {
    inProgress: rows.filter((r) => !r.complete).length,
    stalled: rows.filter((r) => r.stalled).length,
    complete: rows.filter((r) => r.complete).length,
    notStarted: rows.filter((r) => r.done === 0).length,
  };
}

/** True for a client that belongs in the New area (see NEW_CLIENT_DAYS). */
export const isNewClient = (client: ClientRecord, today: string): boolean => onboardingRow(client, today).isNew;
