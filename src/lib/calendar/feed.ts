import { addDays } from "@/lib/dates";
import { toIcs } from "@/lib/ics";
import { buildEvents, type CalendarEvent, type CalendarSources } from "./logic";

/**
 * What a subscribing calendar app is given: every dated item in the workspace from a month ago to a year and a half ahead (older
 * late items are not worth showing in someone's own calendar), as all-day events with stable ids, so a change in AdFlo moves or
 * removes the event in the app instead of adding a copy. Pure: the route loads the records.
 */
export const FEED_PAST_DAYS = 30;
export const FEED_FUTURE_DAYS = 548;
/** Subscribing apps are asked to check back this often. */
export const FEED_REFRESH_HOURS = 6;

export function feedEvents(src: CalendarSources, today: string): CalendarEvent[] {
  const from = addDays(today, -FEED_PAST_DAYS);
  const to = addDays(today, FEED_FUTURE_DAYS);
  return buildEvents(src, today).filter((e) => e.day >= from && e.day <= to);
}

/** The calendar file for the feed. Each event says what it is and, in its description, where to open it in AdFlo. */
export function feedIcs(events: CalendarEvent[], o: { name: string; today: string; origin: string }): string {
  const name = o.name.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();
  return toIcs(
    events.map((e) => ({ uid: e.id, day: e.day, summary: e.title, description: `${e.detail}${e.late ? " (overdue)" : ""}\nOpen in AdFlo: ${o.origin}${e.href}` })),
    o.today,
    { name: name ? `AdFlo: ${name}` : "AdFlo", refreshHours: FEED_REFRESH_HOURS },
  );
}
