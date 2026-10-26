"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useToday } from "@/components/modules/use-today";
import { isSnoozed } from "@/lib/dashboard/snooze";
import { useSnoozed } from "@/lib/dashboard/storage";
import type { AttentionItem, Severity } from "@/lib/dashboard/logic";
import { cn } from "@/lib/utils";

const DOT: Record<Severity, string> = { critical: "bg-red-500", warning: "bg-amber-500", info: "bg-sky-500" };
const SHOWN = 8;

/**
 * The bell in the top bar: the same "needs your attention" items as the dashboard (already computed on
 * the server), minus the ones snoozed in this browser. Opens a short list; each row goes to its service.
 */
export function NotificationBell({ items, serverToday, overviewHref = "/app/overview" }: { items: AttentionItem[]; serverToday: string; overviewHref?: string }) {
  const today = useToday(serverToday) ?? serverToday;
  const snoozed = useSnoozed();
  const live = items.filter((i) => !isSnoozed(snoozed, i.id, today));
  const urgent = live.filter((i) => i.severity === "critical").length;
  const label = live.length === 0 ? "Notifications" : `Notifications, ${live.length} need attention`;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" aria-label={label} className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="size-5" aria-hidden />
          {live.length > 0 && (
            <span data-testid="notification-count" aria-hidden className={cn("absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1 text-center text-[11px] font-semibold leading-5 text-white", urgent > 0 ? "bg-red-600" : "bg-amber-600")}>
              {live.length > 99 ? "99+" : live.length}
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} aria-label="Notifications" className="z-[60] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border bg-popover p-1 text-popover-foreground shadow-panel animate-fade-in outline-none">
          <div className="px-3 py-2 text-sm font-semibold">Notifications</div>
          {live.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {live.slice(0, SHOWN).map((i) => (
                <li key={i.id}>
                  <PopoverPrimitive.Close asChild>
                    <Link href={i.href} className="flex items-start gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent">
                      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[i.severity])} />
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">{i.area} · {i.label}</span>
                        <span className="block">{i.text}</span>
                      </span>
                    </Link>
                  </PopoverPrimitive.Close>
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
