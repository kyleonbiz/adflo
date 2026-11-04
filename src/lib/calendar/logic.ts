import { addDays } from "@/lib/dates";
import type { Invoice } from "@/lib/invoices/types";
import type { License } from "@/lib/licenses/types";
import type { Reminder } from "@/lib/reminders/logic";
import type { Project } from "@/lib/projects/types";
import type { Vendor } from "@/lib/vendors/types";

export const EVENT_KINDS = ["Invoices", "Licenses", "Tasks", "Vendors", "Reminders"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** One thing that falls on one day. `late` marks anything whose day has already passed and is still open. */
export interface CalendarEvent {
  id: string;
  day: string;
  title: string;
  detail: string;
  kind: EventKind;
  href: string;
  late: boolean;
}

export interface CalendarSources {
  invoices: Invoice[];
  licenses: License[];
  projects: Project[];
  vendors: Vendor[];
  reminders: Reminder[];
}

const isDayString = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Everything with a date, from every service, soonest first. Done, paid and void items are left out: the calendar is for what is still ahead or late. */
export function buildEvents(src: CalendarSources, today: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const add = (e: Omit<CalendarEvent, "late">) => { if (isDayString(e.day)) out.push({ ...e, late: e.day < today }); };

  for (const i of src.invoices) {
    if (i.status !== "sent") continue;
    add({ id: `inv-${i.id}`, day: i.dueOn, title: `${i.number} due`, detail: i.client, kind: "Invoices", href: "/app/invoices" });
  }
  for (const l of src.licenses) {
    add({ id: `lic-${l.id}`, day: l.expiresOn, title: `${l.name} expires`, detail: l.issuer || "License", kind: "Licenses", href: "/app/licenses" });
    for (const days of l.reminderDays ?? []) {
      const day = addDays(l.expiresOn, -days);
      if (day >= today) add({ id: `lic-${l.id}-r${days}`, day, title: `Renew ${l.name}`, detail: `${days} days left`, kind: "Licenses", href: "/app/licenses" });
    }
  }
  for (const p of src.projects) {
    for (const t of p.tasks) {
      if (!t.done && t.dueOn) add({ id: `task-${t.id}`, day: t.dueOn, title: t.title, detail: p.name, kind: "Tasks", href: "/app/projects" });
    }
    for (const m of p.milestones ?? []) {
      if (!m.doneOn) add({ id: `ms-${m.id}`, day: m.dueOn, title: `Milestone: ${m.title}`, detail: p.name, kind: "Tasks", href: "/app/projects?view=projects" });
    }
  }
  for (const v of src.vendors) {
    if (v.status === "inactive") continue;
    for (const d of v.documents) {
      if (d.required && d.expiresOn) add({ id: `vd-${d.id}`, day: d.expiresOn, title: `${d.type} expires`, detail: v.name, kind: "Vendors", href: "/app/vendors" });
    }
    if (v.contractEndsOn) add({ id: `vc-${v.id}`, day: v.contractEndsOn, title: `Contract ends`, detail: v.name, kind: "Vendors", href: "/app/vendors" });
  }
  for (const r of src.reminders) {
    add({ id: r.id, day: r.on, title: r.text, detail: "Reminder", kind: "Reminders", href: r.href });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title));
}

export function byDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) map.set(e.day, [...(map.get(e.day) ?? []), e]);
  return map;
}

export interface GridDay { day: string; inMonth: boolean }

/** The weeks that show a month, Sunday first, padded with the neighbouring months' days. `month` is `YYYY-MM-01`. */
export function monthGrid(month: string): GridDay[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = addDays(month, -first.getUTCDay());
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((first.getUTCDay() + daysInMonth) / 7);
  const prefix = month.slice(0, 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      return { day, inMonth: day.startsWith(prefix) };
    }),
  );
}

export const monthOf = (day: string): string => `${day.slice(0, 7)}-01`;

/** "November 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The next events from `today` on (late ones first), for the agenda list. */
export function agenda(events: CalendarEvent[], today: string, days = 60): CalendarEvent[] {
  const last = addDays(today, days);
  return events.filter((e) => e.day <= last);
}
