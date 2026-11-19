"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import type { AlertSeverity, ControlAlert } from "@/lib/control/alerts";
import { cn } from "@/lib/utils";

const DOT: Record<AlertSeverity, string> = { critical: "bg-red-500", warning: "bg-amber-500", info: "bg-sky-500" };
const SHOWN = 8;

/**
 * The bell in the Control center's top bar: what needs staff attention (support tickets, errors, clients stuck in setup,
 * owners waiting for a welcome, agreements). The list is worked out on the server for each page; each row opens the place
 * where it is dealt with. It has nothing to do with the client app's bell and shares none of its browser storage.
 */
export function ControlBell({ items }: { items: ControlAlert[] }) {
  const urgent = items.filter((i) => i.severity === "critical").length;
  const needAction = items.filter((i) => i.severity !== "info").length;
  const label = items.length === 0 ? "Notifications" : `Notifications, ${items.length} to look at`;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" aria-label={label} className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card outline-none hover:bg-primary/10 hover:ring-1 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="size-5" aria-hidden />
          {items.length > 0 && (
            <span data-testid="control-bell-count" aria-hidden className={cn("absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1 text-center text-[11px] font-semibold leading-5 text-white", urgent > 0 ? "bg-red-600" : needAction > 0 ? "bg-amber-600" : "bg-sky-600")}>
              {items.length > 99 ? "99+" : items.length}
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} aria-label="Notifications" className="z-[60] w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border bg-popover p-1 text-popover-foreground shadow-panel animate-fade-in outline-none">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {items.length > 0 && <p className="text-xs text-muted-foreground">{urgent > 0 ? `${urgent} urgent` : needAction > 0 ? `${needAction} need${needAction === 1 ? "s" : ""} action` : "Good news only"}</p>}
          </div>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted-foreground">You&apos;re all caught up. Nothing needs staff right now.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.slice(0, SHOWN).map((i) => (
                <li key={i.id}>
                  <PopoverPrimitive.Close asChild>
                    <Link href={i.href} className="flex min-w-0 items-start gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent">
                      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[i.severity])} />
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">{i.area} · {i.label}</span>
                        <span className="block break-words">{i.text}</span>
                      </span>
                    </Link>
                  </PopoverPrimitive.Close>
                </li>
              ))}
            </ul>
          )}
          {items.length > SHOWN && <p className="px-3 py-2 text-xs text-muted-foreground">{items.length - SHOWN} more not shown. The Onboarding, Support and Monitoring pages list everything.</p>}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
