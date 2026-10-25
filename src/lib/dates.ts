/** Calendar-day helpers. Days are `YYYY-MM-DD` strings handled in UTC, so no timezone drift. */

const DAY_MS = 86_400_000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDay(value: string): boolean {
  const m = DAY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function parse(day: string): number {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Invalid day: ${day}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The caller's local calendar day. */
export function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export function addDays(day: string, n: number): string {
  return format(parse(day) + n * DAY_MS);
}

/** Adds calendar months, clamping to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(day: string, months: number): string {
  const d = new Date(parse(day));
  const target = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), target + 1, 0)).getUTCDate();
  return format(Date.UTC(d.getUTCFullYear(), target, Math.min(d.getUTCDate(), lastDay)));
}

export function formatDayLong(day: string): string {
  return new Date(parse(day)).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export type Every = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

/** The next occurrence of a repeating schedule after `day`. */
export function advanceDay(day: string, every: Every): string {
  switch (every) {
    case "daily": return addDays(day, 1);
    case "weekly": return addDays(day, 7);
    case "monthly": return addMonths(day, 1);
    case "quarterly": return addMonths(day, 3);
    case "yearly": return addMonths(day, 12);
  }
}
