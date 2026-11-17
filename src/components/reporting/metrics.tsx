"use client";

import Link from "next/link";
import { IconSquare } from "@/components/modules/icon-square";
import { MODULE_ICONS } from "@/components/modules/module-icons";
import type { ModuleReport, ReportTone } from "@/lib/reporting/logic";

const TONE: Record<ReportTone, string> = { neutral: "", warning: "text-amber-600", danger: "text-red-600" };

/** Every service's key numbers on one screen, so how the business stands is visible without opening each report. */
export function Metrics({ reports, onOpen }: { reports: ModuleReport[]; onOpen: (id: string) => void }) {
  const withData = reports.filter((r) => r.count > 0);
  if (withData.length === 0) {
    return (
      <section aria-label="Metrics" data-testid="metrics-empty" className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
        Metrics appear here once you have records in a service.
      </section>
    );
  }
  return (
    <div className="space-y-4" data-testid="metrics">
      {withData.map((r) => {
        const Icon = MODULE_ICONS[r.id];
        return (
          <section key={r.id} aria-label={`${r.name} metrics`} className="rounded-2xl border bg-card p-4 shadow-panel">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                {Icon && <IconSquare icon={Icon} size="sm" />} {r.name}
                <span className="text-sm font-normal text-muted-foreground">{r.count} {r.noun}</span>
              </h2>
              <button type="button" onClick={() => onOpen(r.id)} className="rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open full report</button>
            </div>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {r.metrics.map((m) => (
                <div key={m.label} data-testid="metric-tile" className="min-w-0 rounded-xl bg-muted/40 p-3">
                  <dt className="truncate text-xs text-muted-foreground" title={m.label}>{m.label}</dt>
                  <dd className={`mt-0.5 break-words text-xl font-semibold tabular-nums ${TONE[m.tone]}`}>{m.value}</dd>
                  {m.note && <p className="mt-1 text-xs text-muted-foreground">{m.note}</p>}
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground"><Link href="/app/reporting?section=scheduled" className="underline-offset-2 hover:underline">Schedule these as emailed reports</Link></p>
    </div>
  );
}
