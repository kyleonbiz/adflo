"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowDown, BellOff, CheckCircle2, Clock, DollarSign, FolderKanban, Info, ListPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MiniBars, ProgressRing, UpcomingChart, WorkloadChart } from "@/components/modules/dashboard-charts";
import { TodayTodos } from "@/components/modules/today-todos";
import { useToday } from "@/components/modules/use-today";
import { Button } from "@/components/ui/button";
import type { Area, AttentionItem, DashboardData, Kpi, Severity } from "@/lib/dashboard/logic";
import { isSnoozed, pruneSnoozed, snooze } from "@/lib/dashboard/snooze";
import { saveSnoozed, useSnoozed } from "@/lib/dashboard/storage";
import { addTodo, newTodoId, hasOpenTodo, pruneTodos, todaysTodos } from "@/lib/todos/logic";
import { saveTodos, useTodos } from "@/lib/todos/storage";
import { cn } from "@/lib/utils";

const SEVERITY_ICON: Record<Severity, { Icon: LucideIcon; tone: string }> = {
  critical: { Icon: AlertTriangle, tone: "text-red-600" },
  warning: { Icon: Clock, tone: "text-amber-600" },
  info: { Icon: Info, tone: "text-brand-blue" },
};
const AREAS: Area[] = ["Invoices", "Licenses", "Tasks"];
const SHOWN = 5;

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
              <Link href={it.href} className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border bg-card shadow-panel", SEVERITY_ICON[it.severity].tone)}>
                  {(() => { const { Icon } = SEVERITY_ICON[it.severity]; return <Icon className="size-5" aria-hidden />; })()}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-medium">{it.text}</span>
                  <span className="block truncate text-xs text-muted-foreground">{it.area} · {it.label}</span>
                </span>
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

const NOTE = {
  good: { Icon: CheckCircle2, tone: "text-emerald-600" },
  warn: { Icon: Clock, tone: "text-amber-600" },
  bad: { Icon: ArrowDown, tone: "text-red-600" },
} as const;
const KPI_ICON: Record<string, { Icon: LucideIcon; box: string }> = {
  money: { Icon: DollarSign, box: "bg-emerald-500" },
  tasks: { Icon: FolderKanban, box: "bg-amber-400" },
};

function KpiCard({ kpi, bars }: { kpi: Kpi; bars: number[] }) {
  const { Icon: NoteIcon, tone } = NOTE[kpi.note.tone];
  const icon = KPI_ICON[kpi.id];
  return (
    <Link href={kpi.href} className="flex min-h-36 flex-col justify-between rounded-2xl border bg-card p-4 shadow-panel outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring">
      <div>
        <p className="text-3xl font-semibold tabular-nums">{kpi.value}</p>
        <p className="text-sm text-muted-foreground">{kpi.label}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className={cn("flex items-center gap-1.5 text-sm font-medium", tone)}><NoteIcon className="size-4" aria-hidden /> {kpi.note.text}</p>
        {icon ? (
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-white shadow-sm", icon.box)}><icon.Icon className="size-6" aria-hidden /></span>
        ) : (
          <MiniBars values={bars} label="Needs attention by service" />
        )}
      </div>
    </Link>
  );
}

const STATUS = {
  clear: { text: "ALL CLEAR", dot: "bg-emerald-500", line: "Nothing is late or due soon." },
  watch: { text: "WORTH A LOOK", dot: "bg-amber-400", line: "A few things are coming due." },
  attention: { text: "NEEDS ATTENTION", dot: "bg-red-500", line: "Something is overdue." },
} as const;

/** How much of today's list is done, next to the overall state of the back office. */
function ProgressCard({ today, status }: { today: string; status: DashboardData["status"] }) {
  const list = todaysTodos(useTodos(), today);
  const done = list.filter((t) => t.done).length;
  const pct = list.length === 0 ? 0 : Math.round((done / list.length) * 100);
  const s = STATUS[status];
  return (
    <section aria-labelledby="progress-heading" className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="progress">
      <h2 id="progress-heading" className="text-base font-semibold">Today&apos;s progress</h2>
      <div className="mt-2 flex items-center justify-around gap-3">
        <ProgressRing percent={pct} label="Today's tasks done" />
        <div className="text-sm">
          <p className="text-muted-foreground">{list.length === 0 ? "No tasks for today" : `${done} of ${list.length} tasks done`}</p>
          <p className="mt-3 text-muted-foreground">Status</p>
          <p className="flex items-center gap-2 font-semibold tracking-wide"><span className={cn("size-3 rounded-full", s.dot)} aria-hidden /> {s.text}</p>
          <p className="mt-1 max-w-48 text-xs text-muted-foreground">{s.line}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * The signed-in landing page. The numbers, charts and action list arrive already computed from the server
 * (`data`), so the first paint is complete; only the visitor's own to-dos and snoozes are read in the browser.
 */
export function Dashboard({ data, serverToday }: { base?: "/app"; data: DashboardData; serverToday: string; name?: string }) {
  const today = useToday(serverToday) ?? serverToday;
  const bars = data.workload.map((w) => w.attention);

  return (
    <div className="space-y-5" data-testid="dashboard">
      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-3">
        {data.kpis.map((k) => <KpiCard key={k.id} kpi={k} bars={bars} />)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="workload-heading" className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="workload">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="workload-heading" className="text-base font-semibold">Open work by service</h2>
              <p className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand-sky" aria-hidden /> Open</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand-purple-deep" aria-hidden /> Needs attention</span>
              </p>
            </div>
            <div className="mt-3"><WorkloadChart rows={data.workload} /></div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <ProgressCard today={today} status={data.status} />
            <section aria-labelledby="upcoming-heading" className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="upcoming">
              <h2 id="upcoming-heading" className="text-base font-semibold">Due in the next 7 days</h2>
              <div className="mt-2"><UpcomingChart days={data.upcoming} /></div>
            </section>
          </div>
        </div>

        <aside aria-label="Today and attention" className="order-first min-w-0 space-y-5 xl:order-none">
          <TodayTodos today={today} />
          <Attention items={data.items} today={today} />
        </aside>
      </div>
    </div>
  );
}
