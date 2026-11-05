import { addDays, isDay } from "@/lib/dates";
import type { AttentionItem } from "@/lib/dashboard/logic";

/**
 * "Remind me": a note to come back to a request or a task on a chosen day. It shows in the bell and on
 * the home screen from that day until you clear it, so a small job does not slip out of sight.
 */
export interface Reminder {
  /** Stable per thing, so asking again moves the date instead of adding a second one. */
  id: string;
  text: string;
  area: "Tasks";
  href: string;
  /** The first day it shows, `YYYY-MM-DD`. */
  on: string;
}

export const REMINDER_PREFIX = "rem-";
export const MAX_REMINDERS = 100;

export const REMIND_CHOICES = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
] as const;

export const reminderId = (kind: "request" | "task", id: string) => `${REMINDER_PREFIX}${kind}-${id}`;

export function setReminder(list: Reminder[], r: Omit<Reminder, "on">, today: string, days: number): Reminder[] {
  const next: Reminder = { ...r, text: r.text.slice(0, 160), on: addDays(today, days) };
  return [...list.filter((x) => x.id !== r.id), next].slice(-MAX_REMINDERS);
}

export const clearReminder = (list: Reminder[], id: string): Reminder[] => list.filter((r) => r.id !== id);

export const dueReminders = (list: Reminder[], today: string): Reminder[] =>
  list.filter((r) => r.on <= today).sort((a, b) => a.on.localeCompare(b.on));

/** Due reminders as items for the bell and the home feed. */
export function reminderItems(list: Reminder[], today: string): AttentionItem[] {
  return dueReminders(list, today).map((r) => ({ id: r.id, area: r.area, severity: "warning" as const, label: "Reminder", text: r.text, href: r.href }));
}

export function parseReminders(raw: string): Reminder[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((r): r is Reminder =>
        !!r && typeof r.id === "string" && r.id.startsWith(REMINDER_PREFIX) && typeof r.text === "string" && r.area === "Tasks" &&
        typeof r.href === "string" && r.href.startsWith("/app/") && typeof r.on === "string" && isDay(r.on))
      .slice(0, MAX_REMINDERS);
  } catch { return []; }
}
