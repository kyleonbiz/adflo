"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, BellOff, CalendarClock, FolderKanban, Inbox, ListPlus, Plus, Receipt, ShieldCheck, Store, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SummaryTile } from "@/components/modules/summary-tile";
import { TodayTodos } from "@/components/modules/today-todos";
import { useToday } from "@/components/modules/use-today";
import type { Area, AttentionItem, DashboardData, Severity, Tone } from "@/lib/dashboard/logic";
import { isSnoozed, pruneSnoozed, snooze } from "@/lib/dashboard/snooze";
import { saveSnoozed, useSnoozed } from "@/lib/dashboard/storage";
import { addTodo, newTodoId, hasOpenTodo, pruneTodos } from "@/lib/todos/logic";
import { saveTodos, useTodos } from "@/lib/todos/storage";
import { cn } from "@/lib/utils";

const BADGE = { critical: "danger", warning: "warning", info: "default" } as const satisfies Record<Severity, string>;
const TILE_ICON: Record<string, LucideIcon> = {
  outstanding: Receipt, "overdue-invoices": AlertTriangle, licenses: ShieldCheck, vendors: Store,
  tasks: FolderKanban, "overdue-tasks": CalendarClock, requests: Inbox, approvals: Inbox,
};
const TONE: Record<Tone, string> = { neutral: "text-primary", warning: "text-amber-600", danger: "text-red-600" };
const AREAS: Area[] = ["Invoices", "Licenses", "Projects", "Admin"];
const SHOWN = 5;

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
        <p className="text-lg font-medium" data-testid="greeting">{greeting}{name ? `, ${name}` : ""}</p>
        <QuickActions base={base} />
      </div>

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

      <Attention items={data.items} today={today} />
    </div>
  );
}
