"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, BellOff, Hourglass, CalendarClock, FolderKanban, Inbox, ListPlus, Plus, Receipt, ShieldCheck, Store, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { MODULE_ICONS } from "@/components/modules/module-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SummaryTile } from "@/components/modules/summary-tile";
import { TodayTodos } from "@/components/modules/today-todos";
import { useToday } from "@/components/modules/use-today";
import type { Area, AttentionItem, DashboardData, QueueItem, Severity, Tone } from "@/lib/dashboard/logic";
import { formatDayLong } from "@/lib/dates";
import { isSnoozed, pruneSnoozed, snooze } from "@/lib/dashboard/snooze";
import { saveSnoozed, useSnoozed } from "@/lib/dashboard/storage";
import { addTodo, newTodoId, hasOpenTodo, pruneTodos } from "@/lib/todos/logic";
import { saveTodos, useTodos } from "@/lib/todos/storage";
import { STALE_QUEUE_DAYS } from "@/lib/dashboard/logic";
import { cn } from "@/lib/utils";

const BADGE = { critical: "danger", warning: "warning", info: "default" } as const satisfies Record<Severity, string>;
const TILE_ICON: Record<string, LucideIcon> = {
  outstanding: Receipt, "overdue-invoices": AlertTriangle, licenses: ShieldCheck, vendors: Store,
  tasks: FolderKanban, "overdue-tasks": CalendarClock, requests: Inbox, approvals: Inbox,
};
const TONE: Record<Tone, string> = { neutral: "text-primary", warning: "text-amber-600", danger: "text-red-600" };
const AREAS: Area[] = ["Invoices", "Licenses", "Projects", "Admin"];
const SHOWN = 5;

/** One plain sentence on how the day looks. */
function summary(data: DashboardData): string {
  const urgent = data.items.filter((i) => i.severity === "critical").length;
  if (urgent > 0) return `${urgent} ${urgent === 1 ? "thing is" : "things are"} overdue`;
  if (data.queue.length > 0) return `${data.queue.length} waiting on your decision`;
  if (data.items.length > 0) return `${data.items.length} to keep an eye on`;
  return "nothing needs you right now";
}

/** True while no service holds anything, so the home screen can suggest where to begin. */
const isBlank = (d: DashboardData) =>
  d.items.length === 0 && d.queue.length === 0 && d.groups.every((g) => g.tiles.every((t) => t.tone === "neutral" && /^(\$?0(\.00)?)$/.test(t.value)));

const subscribe = () => () => {};
/** Morning, afternoon or evening by the visitor's clock; null on the server so the first paint matches. */
function useGreeting(): string | null {
  return useSyncExternalStore(subscribe, () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, () => null);
}

function QuickActions({ base }: { base: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
      <Button asChild size="sm"><Link href={`${base}/invoices?new=1`}><Plus /> New invoice</Link></Button>
      <Button asChild size="sm" variant="outline"><Link href={`${base}?upload=1`}><Upload /> Upload document</Link></Button>
      <Button asChild size="sm" variant="outline"><Link href={`${base}/admin?new=1`}><Plus /> New request</Link></Button>
    </div>
  );
}

/** Shown only while nothing has been added yet: one card per service, each leading to its first step. */
function WhereToBegin({ base }: { base: "/app" }) {
  const START = ["invoices", "licenses", "contacts", "projects", "admin", "forms"];
  const cards = START.flatMap((slug) => {
    const m = MODULES.find((x) => (x.slug ?? x.id) === slug);
    const href = m ? moduleHref(m, base) : null;
    return m && href ? [{ m, href }] : [];
  });
  return (
    <section aria-labelledby="begin-heading" data-testid="where-to-begin" className="space-y-3">
      <div>
        <h2 id="begin-heading" className="text-base font-semibold">Where to begin</h2>
        <p className="text-sm text-muted-foreground">Nothing is set up yet. Pick whichever is costing you the most time.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ m, href }) => {
          const Icon = MODULE_ICONS[m.id];
          return (
            <li key={m.id}>
              <Link href={href} className="group flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 shadow-panel outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-center gap-2 text-sm font-semibold">{Icon && <Icon className="size-4 text-primary" aria-hidden />}{m.name}</span>
                <span className="flex-1 text-sm text-muted-foreground">{m.summary}</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What is waiting on a decision from you, oldest first, so nothing sits unseen. */
function Queue({ queue }: { queue: QueueItem[] }) {
  const stale = queue.filter((q) => q.stale).length;
  return (
    <section aria-labelledby="queue-heading" className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="queue">
      <h2 id="queue-heading" className="flex items-center gap-2 text-base font-semibold"><Hourglass className="size-4 text-muted-foreground" aria-hidden /> Waiting on you</h2>
      {queue.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing is waiting on a decision.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{queue.length} waiting{stale > 0 ? `, ${stale} for ${STALE_QUEUE_DAYS}+ days` : ""}</p>
          <ul className="mt-3 divide-y">
            {queue.map((q) => (
              <li key={q.id} data-testid="queue-item">
                <Link href={q.href} className="flex items-center gap-3 rounded-md py-2 text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1 truncate"><span className="text-muted-foreground">{q.kind} · </span>{q.title}</span>
                  <Badge variant={q.stale ? "warning" : "muted"} className="shrink-0">{q.waitingDays === 0 ? "Today" : `${q.waitingDays}d`}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Attention({ items, today }: { items: AttentionItem[]; today: string }) {
  const snoozed = useSnoozed();
  const todos = useTodos();
  const [area, setArea] = useState<"all" | Area>("all");
  const [all, setAll] = useState(false);

  const live = items.filter((i) => !isSnoozed(snoozed, i.id, today));
  const hidden = items.length - live.length;
  const counts = (a: Area) => live.filter((i) => i.area === a).length;
  const filtered = area === "all" ? live : live.filter((i) => i.area === area);
  const shown = all ? filtered : filtered.slice(0, SHOWN);

  const doSnooze = (id: string) => saveSnoozed(snooze(pruneSnoozed(snoozed, today), id, today));
  const addToToday = (i: AttentionItem) => saveTodos(pruneTodos(addTodo(todos, i.text, today, newTodoId(), { href: i.href, area: i.area }), today));

  return (
    <section aria-labelledby="attention-heading" className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="attention">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="attention-heading" className="text-base font-semibold">Needs your attention</h2>
        {live.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by service">
            {(["all", ...AREAS] as const).filter((a) => a === "all" || counts(a) > 0).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={area === a}
                onClick={() => { setArea(a); setAll(false); }}
                className={cn("rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", area === a ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
              >
                {a === "all" ? `All (${live.length})` : `${a} (${counts(a)})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {live.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">You are all caught up.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {shown.map((it) => (
            <li key={it.id} data-testid="attention-item" className="flex items-center gap-2 py-2">
              <Link href={it.href} className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <Badge variant={BADGE[it.severity]} className="shrink-0">{it.label}</Badge>
                <span className="min-w-0 flex-1 truncate"><span className="text-muted-foreground">{it.area} · </span>{it.text}</span>
              </Link>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Add to Today: ${it.text}`} title="Add to Today" disabled={hasOpenTodo(todos, it.text, today)} onClick={() => addToToday(it)}><ListPlus /></Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Snooze until tomorrow: ${it.text}`} title="Snooze until tomorrow" onClick={() => doSnooze(it.id)}><BellOff /></Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {filtered.length > SHOWN && (
          <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            {all ? "Show fewer" : `View all (${filtered.length})`}
          </button>
        )}
        {hidden > 0 && (
          <span className="text-muted-foreground">
            {hidden} snoozed until tomorrow ·{" "}
            <button type="button" onClick={() => saveSnoozed({})} className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">Restore</button>
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * The signed-in landing page. The numbers and the action list arrive already computed from the server
 * (`data`), so the first paint is complete; only the visitor's own to-dos, snoozes and greeting are read in the browser.
 */
export function Dashboard({ base, data, serverToday, name }: { base: "/app"; data: DashboardData; serverToday: string; name?: string }) {
  const today = useToday(serverToday) ?? serverToday;
  const greeting = useGreeting() ?? "Welcome back";

  return (
    <div className="space-y-5" data-testid="dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xl font-semibold tracking-tight" data-testid="greeting">{greeting}{name ? `, ${name.split(/\s+/)[0]}` : ""}</p>
          <p className="text-sm text-muted-foreground" data-testid="day-summary">{formatDayLong(today)} · {summary(data)}</p>
        </div>
        <QuickActions base={base} />
      </div>

      {isBlank(data) && <WhereToBegin base={base} />}

      <TodayTodos today={today} />

      <div className="grid gap-5 lg:grid-cols-3">
        {data.groups.map((g) => (
          <section key={g.title} aria-labelledby={`group-${g.title}`} className="space-y-2">
            <h2 id={`group-${g.title}`} className="text-sm font-semibold text-muted-foreground">{g.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {g.tiles.map((t) => <SummaryTile key={t.id} icon={TILE_ICON[t.id] ?? Inbox} label={t.label} value={t.value} tone={TONE[t.tone]} href={t.href} />)}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3"><Attention items={data.items} today={today} /></div>
        <div className="lg:col-span-2"><Queue queue={data.queue} /></div>
      </div>
    </div>
  );
}
