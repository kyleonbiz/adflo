import { advanceDay, isDay } from "@/lib/dates";
import type { ModuleReport } from "./logic";

export const SCHEDULE_EVERY = [
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every quarter" },
] as const;
export type ScheduleEvery = (typeof SCHEDULE_EVERY)[number]["value"];

/** `reportId` is a module report's id, or "overview" for the one-page summary of everything. */
export interface ScheduledReport {
  id: string;
  reportId: string;
  every: ScheduleEvery;
  /** The next day this report is due, `YYYY-MM-DD`. */
  nextOn: string;
  /** Who should get it, comma separated. May be empty. */
  recipients: string;
}

export const OVERVIEW_ID = "overview";

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** The addresses in a comma-separated list, and the ones that are not addresses. */
export function parseRecipients(text: string): { valid: string[]; invalid: string[] } {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  return { valid: parts.filter((p) => EMAIL.test(p)), invalid: parts.filter((p) => !EMAIL.test(p)) };
}

export function addSchedule(list: ScheduledReport[], s: Omit<ScheduledReport, "id">, id: string): ScheduledReport[] {
  return [...list, { ...s, id }];
}

export const removeSchedule = (list: ScheduledReport[], id: string) => list.filter((s) => s.id !== id);

/** Reports that are due on or before `today`, oldest first. */
export const dueSchedules = (list: ScheduledReport[], today: string) =>
  list.filter((s) => s.nextOn <= today).sort((a, b) => a.nextOn.localeCompare(b.nextOn));

/** After a report is delivered, its next date moves forward past today (a long gap is skipped, not replayed). */
export function markDelivered(list: ScheduledReport[], id: string, today: string): ScheduledReport[] {
  return list.map((s) => {
    if (s.id !== id) return s;
    let next = advanceDay(s.nextOn, s.every);
    for (let i = 0; i < 1000 && next <= today; i++) next = advanceDay(next, s.every);
    return { ...s, nextOn: next };
  });
}

export function parseSchedules(raw: string): ScheduledReport[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((s): s is ScheduledReport =>
      !!s && typeof s.id === "string" && typeof s.reportId === "string" && typeof s.recipients === "string" &&
      SCHEDULE_EVERY.some((e) => e.value === s.every) && typeof s.nextOn === "string" && isDay(s.nextOn));
  } catch { return []; }
}

/** A readable one-page text version of a report, for printing or saving as a PDF. */
export function reportText(report: ModuleReport, today: string): string {
  const lines = [`${report.name.toUpperCase()} REPORT`, `As of ${today}`, "", `${report.count} ${report.noun}`, ""];
  if (report.count === 0) return [...lines, "No records yet.", ""].join("\n");
  for (const m of report.metrics) lines.push(`${m.label}: ${m.value}${m.note ? ` (${m.note})` : ""}`);
  for (const b of report.breakdowns) {
    lines.push("", b.title);
    for (const r of b.rows) lines.push(`  ${r.label}: ${r.display ?? r.value}`);
  }
  return lines.join("\n") + "\n";
}

/** Every service's report in one document. */
export function overviewText(reports: ModuleReport[], today: string): string {
  const out = ["BUSINESS SUMMARY", `As of ${today}`, ""];
  for (const r of reports) {
    out.push(`== ${r.name} ==`, ...reportText(r, today).split("\n").slice(3).filter((l, i, a) => !(l === "" && i === a.length - 1)), "");
  }
  return out.join("\n") + "\n";
}
