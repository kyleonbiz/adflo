import type { ClientRecord } from "./types";

/** Reminders to one client are spaced out: no second one within this many hours. */
export const REMIND_COOLDOWN_HOURS = 24;

export type ReminderKind = "signup" | "agreement";
export const isReminderKind = (v: unknown): v is ReminderKind => v === "signup" || v === "agreement";

export interface NextReminder { kind: ReminderKind; label: string; what: string }

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/**
 * What a reminder to this client's owner would be about, or null when there is nothing to remind them of (no owner email,
 * or the owner has signed up and nothing is waiting for them). Signing up comes before accepting agreements.
 */
export function nextReminder(c: Pick<ClientRecord, "ownerEmail" | "workspaceId" | "seatsUsed" | "agreementsWaiting">): NextReminder | null {
  if (!EMAIL.test(c.ownerEmail.trim())) return null;
  if (c.workspaceId && (c.seatsUsed ?? 0) === 0) return { kind: "signup", label: "Remind to sign up", what: "to sign up" };
  if ((c.agreementsWaiting ?? 0) > 0) return { kind: "agreement", label: "Remind to accept", what: "to accept their agreement" };
  return null;
}

/** Hours left before another reminder may go out (0 when one may). */
export function cooldownHoursLeft(lastReminderAt: string | null | undefined, now: Date = new Date()): number {
  if (!lastReminderAt) return 0;
  const t = Date.parse(lastReminderAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.ceil(REMIND_COOLDOWN_HOURS - (now.getTime() - t) / 3_600_000));
}

/** "today", "yesterday", "3 days ago": how long ago a reminder went out. */
export function reminderAgo(lastReminderAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!lastReminderAt) return null;
  const t = Date.parse(lastReminderAt);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}
