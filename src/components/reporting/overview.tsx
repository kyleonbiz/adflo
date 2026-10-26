"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MODULE_ICONS } from "@/components/modules/module-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardData, Severity } from "@/lib/dashboard/logic";
import type { ModuleReport } from "@/lib/reporting/logic";

const BADGE = { critical: "danger", warning: "warning", info: "default" } as const satisfies Record<Severity, string>;
const SHOWN = 6;

export function Overview({ reports, attention, onOpen }: { reports: ModuleReport[]; attention: DashboardData["items"]; onOpen: (id: string) => void }) {
  const total = reports.reduce((n, r) => n + r.count, 0);
  const urgent = attention.filter((i) => i.severity !== "info").length;
  return (
    <div className="space-y-5" data-testid="overview">
      <section aria-labelledby="attention-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h2 id="attention-heading" className="text-base font-semibold">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground" data-testid="attention-empty">
            {total === 0 ? "Nothing to report yet. This fills in as records are added in each service." : "Nothing needs attention right now."}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground" data-testid="attention-count">{attention.length} item{attention.length === 1 ? "" : "s"}{urgent > 0 && `, ${urgent} urgent`}</p>
            <ul className="mt-2 divide-y">
              {attention.slice(0, SHOWN).map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2 text-sm" data-testid="attention-item">
                  <Badge variant={BADGE[i.severity]}>{i.label}</Badge>
                  <Link href={i.href} className="min-w-0 flex-1 truncate hover:underline" title={i.text}>{i.text}</Link>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{i.area}</span>
                </li>
              ))}
            </ul>
            {attention.length > SHOWN && <p className="mt-2 text-xs text-muted-foreground">and {attention.length - SHOWN} more. Open a module report below for the full picture.</p>}
          </>
        )}
      </section>

      <section aria-label="Module reports" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => {
          const Icon = MODULE_ICONS[r.id];
          return (
            <article key={r.id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-panel" data-testid="module-card">
              <h3 className="flex items-center gap-2 text-base font-semibold">{Icon && <Icon className="size-4 text-primary" aria-hidden />} {r.name}</h3>
              <p className="text-xs text-muted-foreground">{r.count === 0 ? "No records yet" : `${r.count} ${r.noun}`}</p>
              {r.count > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  {r.metrics.slice(0, 4).map((m) => (
                    <div key={m.label} className="min-w-0">
                      <dt className="truncate text-xs text-muted-foreground" title={m.label}>{m.label}</dt>
                      <dd className={`truncate text-lg font-semibold tabular-nums ${m.tone === "danger" ? "text-red-600" : m.tone === "warning" ? "text-amber-600" : ""}`}>{m.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-auto pt-4">
                <Button size="sm" variant="outline" onClick={() => onOpen(r.id)} aria-label={`View ${r.name} report`}>
                  View report <ArrowRight />
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
