import { addDays } from "@/lib/dates";

/** Item id -> the first day it shows again. */
export type Snoozed = Record<string, string>;

export const snooze = (s: Snoozed, id: string, today: string): Snoozed => ({ ...s, [id]: addDays(today, 1) });
export const isSnoozed = (s: Snoozed, id: string, today: string): boolean => (s[id] ?? "") > today;

/** Forgets snoozes that have run out, so the saved map stays small. */
export function pruneSnoozed(s: Snoozed, today: string): Snoozed {
  return Object.fromEntries(Object.entries(s).filter(([, until]) => until > today));
}

export function parseSnoozed(raw: string): Snoozed {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([k, v]) => k.length <= 80 && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)).slice(0, 500)) as Snoozed;
  } catch {
    return {};
  }
}
