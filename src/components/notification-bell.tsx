"use client";

import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useToday } from "@/components/modules/use-today";
import { applyPrefs, rememberSeen, unseen } from "@/lib/dashboard/prefs";
import { saveSeen, useSeen } from "@/lib/dashboard/seen-storage";
import { isSnoozed, pruneSnoozed, snooze } from "@/lib/dashboard/snooze";
import { saveSnoozed, useSnoozed } from "@/lib/dashboard/storage";
import type { AttentionItem, QueueItem, Severity } from "@/lib/dashboard/logic";
import { clearReminder, reminderItems } from "@/lib/reminders/logic";
import { saveReminders, useReminders } from "@/lib/reminders/storage";
import { useSettings } from "@/lib/settings/storage";
import { cn } from "@/lib/utils";

const DOT: Record<Severity, string> = { critical: "bg-red-500", warning: "bg-amber-500", info: "bg-sky-500" };
const SHOWN = 8;

/**
 * The bell in the top bar: the same "needs your attention" items as the dashboard (already computed on
 * the server), minus the ones snoozed in this browser. Opens a short list; each row goes to its service.
 */
export function NotificationBell({ items, queue = [], serverToday, overviewHref = "/app/overview" }: { items: AttentionItem[]; queue?: QueueItem[]; serverToday: string; overviewHref?: string }) {
  const today = useToday(serverToday) ?? serverToday;
  const snoozed = useSnoozed();
  const settings = useSettings();
  const seen = useSeen();
  const reminders = useReminders();
  const live = [...reminderItems(reminders, today), ...applyPrefs(items, settings.notifications)].filter((i) => !isSnoozed(snoozed, i.id, today));
  const fresh = unseen(live, seen);
  const overdue = live.filter((i) => i.severity === "critical").length;
  const urgent = live.filter((i) => i.severity === "critical").length;
  const label = live.length === 0 ? "Notifications" : `Notifications, ${live.length} need attention`;

  return (
    <PopoverPrimitive.Root onOpenChange={(open) => { if (!open) saveSeen(rememberSeen(live)); }}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" aria-label={label} className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="size-5" aria-hidden />
          {live.length > 0 && (
            <span data-testid="notification-count" aria-hidden className={cn("absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1 text-center text-[11px] font-semibold leading-5 text-white", urgent > 0 ? "bg-red-600" : "bg-amber-600", fresh.size > 0 && "bell-pulse")}>
              {live.length > 99 ? "99+" : live.length}
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} aria-label="Notifications" className="z-[60] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border bg-popover p-1 text-popover-foreground shadow-panel animate-fade-in outline-none">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {live.length > 0 && <p className="text-xs text-muted-foreground">{overdue > 0 ? `${overdue} overdue` : "Nothing overdue"}{fresh.size > 0 ? ` · ${fresh.size} new` : ""}</p>}
          </div>
          {queue.length > 0 && (
            <div className="border-b px-3 pb-2" data-testid="bell-queue">
              <p className="text-xs font-medium text-muted-foreground">Waiting on you</p>
              <ul>
                {queue.slice(0, 3).map((q) => (
                  <li key={q.id}>
                    <PopoverPrimitive.Close asChild>
                      <Link href={q.href} className="flex items-center justify-between gap-2 rounded-md py-1 text-sm outline-none hover:underline focus-visible:underline">
                        <span className="min-w-0 truncate">{q.kind} · {q.title}</span>
                        <span className={cn("shrink-0 text-xs", q.stale ? "font-medium text-amber-700" : "text-muted-foreground")}>{q.waitingDays === 0 ? "today" : `${q.waitingDays}d`}</span>
                      </Link>
                    </PopoverPrimitive.Close>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {live.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted-foreground">{items.length > live.length ? "Nothing else needs you. Some items are snoozed or switched off in Settings." : "You're all caught up."}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {live.slice(0, SHOWN).map((i) => (
                <li key={i.id} className="group flex items-start">
                  <PopoverPrimitive.Close asChild>
                    <Link href={i.href} className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent">
                      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[i.severity])} />
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">{i.area} · {i.label}{fresh.has(i.id) && <span className="ml-1.5 rounded bg-primary/10 px-1 font-medium text-primary" data-testid="bell-new">New</span>}</span>
                        <span className="block">{i.text}</span>
                      </span>
                    </Link>
                  </PopoverPrimitive.Close>
                  <button
                    type="button"
                    aria-label={i.id.startsWith("rem-") ? `Clear reminder: ${i.text}` : `Snooze until tomorrow: ${i.text}`}
                    title={i.id.startsWith("rem-") ? "Clear reminder" : "Snooze until tomorrow"}
                    onClick={() => (i.id.startsWith("rem-") ? saveReminders(clearReminder(reminders, i.id)) : saveSnoozed(snooze(pruneSnoozed(snoozed, today), i.id, today)))}
                    className="mt-1.5 mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  ><BellOff className="size-3.5" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <PopoverPrimitive.Close asChild>
            <Link href={overviewHref} className="mt-1 block rounded-md border-t px-3 py-2 text-sm font-medium text-primary outline-none hover:bg-accent focus-visible:bg-accent">
              {live.length > SHOWN ? `View all ${live.length} on the dashboard` : "Open dashboard"}
            </Link>
          </PopoverPrimitive.Close>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
