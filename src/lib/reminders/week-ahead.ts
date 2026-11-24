import { addDays, formatDayLong } from "@/lib/dates";
import { brandedEmail } from "@/lib/mail/layout";
import { byDay, type CalendarEvent } from "@/lib/calendar/logic";

/** The week-ahead email lists at most this many late items and this many items for the week; the rest are counted. */
export const MAX_LATE = 8;
export const MAX_WEEK = 30;
/** Late items older than this are left out: they are old news, not this week's job. */
export const LATE_LOOKBACK_DAYS = 60;

export interface WeekAhead {
  late: CalendarEvent[];
  days: [string, CalendarEvent[]][];
  lateTotal: number;
  weekTotal: number;
}

const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim();

/** What is late and what falls in the next seven days (today included), from the same events the Calendar page shows. Null when there is nothing. */
export function weekAhead(events: CalendarEvent[], today: string): WeekAhead | null {
  const last = addDays(today, 6);
  const since = addDays(today, -LATE_LOOKBACK_DAYS);
  const late = events.filter((e) => e.day < today && e.day >= since).sort((a, b) => a.day.localeCompare(b.day));
  const week = events.filter((e) => e.day >= today && e.day <= last);
  if (late.length === 0 && week.length === 0) return null;
  return { late: late.slice(0, MAX_LATE), lateTotal: late.length, weekTotal: week.length, days: [...byDay(week.slice(0, MAX_WEEK))] };
}

const line = (e: CalendarEvent) => `${oneLine(e.title)} (${oneLine(e.detail)})`;

/** The Monday email: late items first, then each day of the week. Plain text and branded HTML. */
export function weekAheadEmail(w: WeekAhead, ctx: { business: string; today: string; appUrl: string }): { subject: string; text: string; html: string } {
  const business = oneLine(ctx.business) || "your business";
  const n = w.weekTotal;
  const subject = `Your week ahead: ${n === 0 ? "nothing due" : `${n} ${n === 1 ? "item" : "items"} due`}${w.lateTotal ? `, ${w.lateTotal} late` : ""}`;
  const intro = [`Here is what is on the calendar for ${business} this week${w.lateTotal ? ", and what is already late" : ""}.`];
  const moreLate = w.lateTotal - w.late.length;
  const moreWeek = w.weekTotal - w.days.reduce((t, [, l]) => t + l.length, 0);

  const text: string[] = [...intro, ""];
  if (w.late.length) {
    text.push("LATE", ...w.late.map((e) => `  - ${formatDayLong(e.day)}: ${line(e)}`));
    if (moreLate > 0) text.push(`  ...and ${moreLate} more`);
    text.push("");
  }
  for (const [day, list] of w.days) text.push(day === ctx.today ? `TODAY, ${formatDayLong(day)}` : formatDayLong(day).toUpperCase(), ...list.map((e) => `  - ${line(e)}`), "");
  if (moreWeek > 0) text.push(`...and ${moreWeek} more this week`, "");
  text.push(`Open the calendar: ${ctx.appUrl}`, "", "You get this because the weekly summary is on in Settings, Notifications.");

  const panel: [string, string][] = [
    ...w.late.map((e): [string, string] => [`Late: ${oneLine(e.title)}`, `${oneLine(e.detail)} · was ${formatDayLong(e.day)}`]),
    ...(moreLate > 0 ? [["More late", `${moreLate} more`] as [string, string]] : []),
    ...w.days.flatMap(([day, list]) => list.map((e): [string, string] => [oneLine(e.title), `${day === ctx.today ? "Today" : formatDayLong(day)} · ${oneLine(e.detail)}`])),
    ...(moreWeek > 0 ? [["More this week", `${moreWeek} more`] as [string, string]] : []),
  ];
  return {
    subject,
    text: text.join("\n"),
    html: brandedEmail({
      preheader: intro[0], headline: "Your week ahead", intro, panel,
      buttons: [{ label: "Open the calendar", url: ctx.appUrl }],
      fine: ["You get this because the weekly summary is on in Settings, Notifications."],
    }),
  };
}
