"use client";

import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Health, HealthRow } from "@/lib/dashboard/health";
import { cn } from "@/lib/utils";

const STATUS = {
  clear: { text: "Everything is in order.", dot: "bg-emerald-500" },
  watch: { text: "A few dates are coming up.", dot: "bg-amber-400" },
  attention: { text: "Something is late.", dot: "bg-red-500" },
} as const;

const daysText = (r: HealthRow) => (r.days === null ? "Missing" : r.days < 0 ? `${-r.days} ${r.days === -1 ? "day" : "days"} late` : r.days === 0 ? "Today" : `${r.days} ${r.days === 1 ? "day" : "days"}`);

/**
 * The administrative health of the business at a glance: what AdFlo is holding and what needs attention soonest, so there is a reason
 * to open it even on a day nothing is uploaded. Brought together from the records the other pages already keep.
 */
export function AdminHealth({ health }: { health: Health }) {
  const s = STATUS[health.status];
  return (
    <section aria-labelledby="health-heading" className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="admin-health">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="health-heading" className="flex items-center gap-2 text-base font-semibold"><HeartPulse className="size-4 text-primary" aria-hidden /> Administrative health</h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><span className={cn("size-2.5 rounded-full", s.dot)} aria-hidden /> {s.text}</p>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Administrative overview">
        {health.tiles.map((t) => (
          <li key={t.id}>
            <Link href={t.href} data-testid={`health-${t.id}`} className="block rounded-xl border bg-background p-3 outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.note}</p>
            </Link>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Attention required</h3>
      {health.rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No renewals, missing records or inspections need attention in the next 60 days.</p>
      ) : (
        <>
          <ul className="mt-1 divide-y" aria-label="Attention required">
            {health.rows.map((r) => (
              <li key={r.id} data-testid="health-row">
                <Link href={r.href} className="flex items-center gap-3 rounded-md py-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                  </span>
                  <Badge variant={r.tone === "neutral" ? "muted" : r.tone} className="shrink-0">{daysText(r)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          {health.total > health.rows.length && <p className="mt-1 text-xs text-muted-foreground">And {health.total - health.rows.length} more. The full list is in Needs your attention.</p>}
        </>
      )}
    </section>
  );
}
