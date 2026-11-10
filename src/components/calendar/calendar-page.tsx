"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToday } from "@/components/modules/use-today";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { agenda, buildEvents, byDay, EVENT_KINDS, monthGrid, monthLabel, monthOf, nextMonth, type CalendarEvent, type EventKind } from "@/lib/calendar/logic";
import { useCalendarSources } from "@/lib/calendar/sources";
import { addDays, addMonths, formatDayLong, formatDayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KIND_STYLE: Record<EventKind, string> = {
  Invoices: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
  Licenses: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
  Tasks: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  Vendors: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  Reminders: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
};
const LATE_STYLE = "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100";
const pill = (e: CalendarEvent) => (e.late ? LATE_STYLE : KIND_STYLE[e.kind]);

function EventRow({ e, testId }: { e: CalendarEvent; testId: string }) {
  return (
    <li data-testid={testId} className="flex items-center gap-3 py-2">
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", pill(e))}>{e.late ? "Late" : e.kind}</span>
      <Link href={e.href} className="min-w-0 flex-1 rounded-md text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        <span className="block truncate font-medium">{e.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{e.detail}</span>
      </Link>
    </li>
  );
}

/** Every date from every service on one calendar: invoices due, licenses expiring, tasks, vendor documents and your reminders. */
export function CalendarPage({ preview }: { preview?: string }) {
  const today = useToday();
  const sources = useCalendarSources(today);
  const [view, setView] = useState<"month" | "agenda" | "next">("month");
  const [month, setMonth] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | EventKind>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => (today ? buildEvents(sources, today) : []), [sources, today]);
  const events = useMemo(() => (kind === "all" ? all : all.filter((e) => e.kind === kind)), [all, kind]);
  const days = useMemo(() => byDay(events), [events]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const shownMonth = month ?? monthOf(today);
  const grid = monthGrid(shownMonth);
  const chosen = selected ?? today;
  const chosenEvents = days.get(chosen) ?? [];
  const upcoming = agenda(events, today);
  const late = upcoming.filter((e) => e.late);
  const ahead = upcoming.filter((e) => !e.late);
  const next = nextMonth(events, today);
  const nextEnd = addDays(addMonths(next.month, 1), -1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Everything with a date, from every service, in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as "all" | EventKind)}>
            <SelectTrigger aria-label="Show on the calendar" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everything</SelectItem>
              {EVENT_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
          <div role="tablist" aria-label="Calendar view" className="flex rounded-lg border bg-card p-0.5">
            {(["month", "agenda", "next"] as const).map((v) => (
              <button
                key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {{ month: "Month", agenda: "Agenda", next: "Next month" }[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {preview && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>}

      {view === "next" ? (
        <section aria-label="Next month" className="space-y-5">
          <div className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="next-month-summary">
            <h2 className="text-lg font-semibold">{next.label}</h2>
            <p className="text-sm text-muted-foreground">
              {next.total === 0 ? "Nothing is due yet." : `${next.total} ${next.total === 1 ? "item" : "items"} coming up, by week.`}
            </p>
            {next.total > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Items by kind">
                {EVENT_KINDS.filter((k) => next.byKind[k]).map((k) => (
                  <li key={k} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", KIND_STYLE[k])}>{k} {next.byKind[k]}</li>
                ))}
              </ul>
            )}
          </div>
          {next.total === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center shadow-panel" data-testid="next-month-empty">
              <h2 className="text-lg font-semibold">Nothing due in {next.label}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Invoices due, licenses expiring, tasks, vendor documents and reminders dated next month show here as you add them.</p>
            </div>
          ) : (
            next.weeks.map((w) => (
              <div key={w.start} className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="next-month-week">
                <h2 className="text-base font-semibold">{formatDayShort(w.start < next.month ? next.month : w.start)} to {formatDayShort(w.end > nextEnd ? nextEnd : w.end)}</h2>
                {[...byDay(w.events)].map(([day, list]) => (
                  <div key={day} className="mt-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{formatDayLong(day)}</h3>
                    <ul className="divide-y">{list.map((e) => <EventRow key={e.id} e={e} testId="next-month-event" />)}</ul>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      ) : view === "month" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-label="Month" className="rounded-2xl border bg-card p-3 shadow-panel sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold" data-testid="calendar-month">{monthLabel(shownMonth)}</h2>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => setMonth(addMonths(shownMonth, -1))}><ChevronLeft /></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setMonth(null); setSelected(null); }}>Today</Button>
                <Button type="button" size="icon-sm" variant="outline" aria-label="Next month" onClick={() => setMonth(addMonths(shownMonth, 1))}><ChevronRight /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border text-xs">
              {WEEKDAYS.map((d) => <div key={d} className="bg-muted px-1 py-1.5 text-center font-medium text-muted-foreground">{d}</div>)}
              {grid.flat().map(({ day, inMonth }) => {
                const list = days.get(day) ?? [];
                const isToday = day === today;
                return (
                  <button
                    key={day} type="button" onClick={() => setSelected(day)} data-testid="calendar-day" data-day={day}
                    aria-pressed={chosen === day}
                    aria-label={`${formatDayLong(day)}, ${list.length === 0 ? "nothing due" : `${list.length} ${list.length === 1 ? "item" : "items"}`}`}
                    className={cn("flex min-h-16 flex-col gap-1 bg-card p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-24 sm:p-1.5", !inMonth && "bg-muted/40 text-muted-foreground", chosen === day && "ring-2 ring-inset ring-primary")}
                  >
                    <span className={cn("grid size-6 place-items-center rounded-full text-xs font-medium", isToday && "bg-primary text-primary-foreground")}>{Number(day.slice(8))}</span>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {list.slice(0, 2).map((e) => <span key={e.id} data-testid="calendar-pill" className={cn("truncate rounded px-1 py-0.5 text-[11px] leading-tight", pill(e))}>{e.title}</span>)}
                      {list.length > 2 && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - 2} more</span>}
                    </span>
                    {list.length > 0 && <span className="flex gap-0.5 sm:hidden" aria-hidden>{list.slice(0, 4).map((e) => <span key={e.id} className={cn("size-1.5 rounded-full", e.late ? "bg-red-500" : "bg-primary")} />)}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <aside aria-label="Selected day" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 className="text-base font-semibold" data-testid="calendar-selected">{chosen === today ? "Today" : formatDayLong(chosen)}</h2>
            {chosen === today && <p className="text-xs text-muted-foreground">{formatDayLong(today)}</p>}
            {chosenEvents.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing is due on this day.</p>
            ) : (
              <ul className="mt-2 divide-y">{chosenEvents.map((e) => <EventRow key={e.id} e={e} testId="calendar-day-event" />)}</ul>
            )}
          </aside>
        </div>
      ) : (
        <section aria-label="Agenda" className="space-y-5">
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center shadow-panel" data-testid="agenda-empty">
              <h2 className="text-lg font-semibold">Nothing coming up</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Invoices due, licenses expiring, tasks and reminders for the next 60 days show here.</p>
            </div>
          ) : (
            <>
              {late.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-card p-4 shadow-panel">
                  <h2 className="text-base font-semibold text-red-700">Late</h2>
                  <ul className="mt-1 divide-y">{late.map((e) => <EventRow key={e.id} e={e} testId="agenda-event" />)}</ul>
                </div>
              )}
              {[...byDay(ahead)].map(([day, list]) => (
                <div key={day} className="rounded-2xl border bg-card p-4 shadow-panel">
                  <h2 className="text-base font-semibold">{day === today ? `Today, ${formatDayLong(day)}` : formatDayLong(day)}</h2>
                  <ul className="mt-1 divide-y">{list.map((e) => <EventRow key={e.id} e={e} testId="agenda-event" />)}</ul>
                </div>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
