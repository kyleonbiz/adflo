/**
 * The "What is admin costing you?" estimate on the landing page.
 *
 * Pure arithmetic on what the visitor typed, so it can be tested without the page. It is an estimate, not a promise:
 * the share of admin time that could be saved and the share of that time put to paying use are assumptions the
 * visitor can change, and both start deliberately modest.
 */

/** Working weeks in a year. 48, not 52, so holidays and leave are not counted as admin time. */
export const WEEKS_PER_YEAR = 48;
/** A full-time working week, used only to say the hours as "working weeks". */
export const HOURS_PER_WORKING_WEEK = 40;

export const LIMITS = {
  hoursPerWeek: { min: 0, max: 400 },
  hourlyValue: { min: 0, max: 1000 },
  savedPct: { min: 10, max: 70 },
  usedPct: { min: 10, max: 100 },
} as const;

export const DEFAULT_SAVED_PCT = 40;
export const DEFAULT_USED_PCT = 50;

export interface AdminCostInput {
  hoursPerWeek: number;
  hourlyValue: number;
  /** Percent of the admin time the platform could take over. */
  savedPct: number;
  /** Percent of the freed time that turns into paying work, or a hire avoided. */
  usedPct: number;
}

export interface AdminCostEstimate {
  /** Hours spent on admin in a year. */
  hoursPerYear: number;
  /** That time as 40-hour working weeks. */
  workingWeeks: number;
  /** What those hours are worth in a year, at the hourly value given. */
  annualCost: number;
  /** Hours a year that could be freed. */
  hoursSaved: number;
  /** The realistic recovery: freed hours that are actually put to paying use. */
  recoverable: number;
}

/** A finite number inside [min, max]; anything else (empty, NaN, text) counts as the minimum. */
export function clampNumber(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function estimateAdminCost(input: AdminCostInput): AdminCostEstimate {
  const hours = clampNumber(input.hoursPerWeek, LIMITS.hoursPerWeek.min, LIMITS.hoursPerWeek.max);
  const rate = clampNumber(input.hourlyValue, LIMITS.hourlyValue.min, LIMITS.hourlyValue.max);
  const saved = clampNumber(input.savedPct, LIMITS.savedPct.min, LIMITS.savedPct.max) / 100;
  const used = clampNumber(input.usedPct, LIMITS.usedPct.min, LIMITS.usedPct.max) / 100;

  const hoursPerYear = hours * WEEKS_PER_YEAR;
  const hoursSaved = hoursPerYear * saved;
  return {
    hoursPerYear,
    workingWeeks: hoursPerYear / HOURS_PER_WORKING_WEEK,
    annualCost: hoursPerYear * rate,
    hoursSaved,
    recoverable: hoursSaved * used * rate,
  };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const formatUsd = (n: number) => usd.format(Math.round(n));

/** "6 working weeks", "1 working week", "under 1 working week". */
export function formatWeeks(weeks: number): string {
  if (weeks < 0.5) return weeks === 0 ? "0 working weeks" : "under 1 working week";
  const w = Math.round(weeks);
  return `${w} working ${w === 1 ? "week" : "weeks"}`;
}
