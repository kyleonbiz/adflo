import { addDays } from "@/lib/dates";

export interface CalendarEvent {
  uid: string;
  /** All-day event on this `YYYY-MM-DD` date. */
  day: string;
  summary: string;
  description?: string;
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** RFC 5545 text escaping: backslash, semicolon, comma and line breaks. */
export function icsEscape(s: string): string {
  return s.replace(CONTROL, "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line at 75 octets, never splitting a multi-byte character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + n > limit) { parts.push(current); current = ""; size = 0; }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compact = (day: string) => day.replace(/-/g, "");

/** A calendar file (.ics) of all-day events. `stamp` is the creation day, used for DTSTAMP. */
export function toIcs(events: CalendarEvent[], stamp: string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AdFlo//Admin Support//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid.replace(/[^A-Za-z0-9._@-]/g, "-")}@adflo`,
      `DTSTAMP:${compact(stamp)}T000000Z`,
      `DTSTART;VALUE=DATE:${compact(e.day)}`,
      `DTEND;VALUE=DATE:${compact(addDays(e.day, 1))}`,
      `SUMMARY:${icsEscape(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
