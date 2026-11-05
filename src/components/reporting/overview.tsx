"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IconSquare } from "@/components/modules/icon-square";
import { MODULE_ICONS } from "@/components/modules/module-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardData, Severity } from "@/lib/dashboard/logic";
import type { ModuleReport, ReportTone } from "@/lib/reporting/logic";
import { cn } from "@/lib/utils";
import { ReportBars } from "./report-bars";

const BADGE = { critical: "danger", warning: "warning", info: "default" } as const satisfies Record<Severity, string>;
const TONE: Record<ReportTone, string> = { neutral: "", warning: "text-amber-600", danger: "text-red-600" };
const SHOWN = 6;

type Status = "attention" | "ok" | "empty";
const statusOf = (r: ModuleReport): Status => (r.count === 0 ? "empty" : r.metrics.some((m) => m.tone !== "neutral") ? "attention" : "ok");
const STATUS_LABEL: Record<Status, { text: string; className: string }> = {
  attention: { text: "Needs attention", className: "bg-amber-100 text-amber-900" },
  ok: { text: "On track", className: "bg-emerald-100 text-emerald-900" },
  empty: { text: "No records yet", className: "bg-muted text-muted-foreground" },
};

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="min-w-0 px-4 py-3 first:pl-0 last:pr-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-2xl font-semibold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

/** The reporting landing page: the headline numbers first, then what to look at, then every service side by side. */
export function Overview({ reports, attention, onOpen }: { reports: ModuleReport[]; attention: DashboardData["items"]; onOpen: (id: string) => void }) {
  const total = reports.reduce((n, r) => n + r.count, 0);
  const inUse = reports.filter((r) => r.count > 0);
  const urgent = attention.filter((i) => i.severity !== "info").length;
  const byService = inUse.map((r) => ({ label: r.name, value: r.count })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5" data-testid="overview">
      <section aria-label="At a glance" className="rounded-2xl border bg-card px-4 shadow-panel sm:px-5" data-testid="overview-summary">
        <dl className="grid grid-cols-2 divide-x sm:grid-cols-4 [&>div:nth-child(3)]:border-t [&>div:nth-child(4)]:border-t sm:[&>div:nth-child(3)]:border-t-0 sm:[&>div:nth-child(4)]:border-t-0 [&>div:nth-child(3)]:pl-0 sm:[&>div:nth-child(3)]:pl-4">
          <Stat label="Records tracked" value={total} />
          <Stat label="Services in use" value={`${inUse.length} of ${reports.length}`} />
          <Stat label="Need attention" value={attention.length} tone={attention.length > 0 ? "text-amber-600" : "text-emerald-600"} />
          <Stat label="Urgent" value={urgent} tone={urgent > 0 ? "text-red-600" : undefined} />
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="attention-heading" className="min-w-0 rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="attention-heading" className="text-base font-semibold">Where to look first</h2>
          {attention.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="attention-empty">
              {total === 0 ? "Nothing to report yet. This fills in as records are added in each service." : "Nothing needs attention right now."}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground" data-testid="attention-count">{attention.length} item{attention.length === 1 ? "" : "s"}{urgent > 0 && `, ${urgent} urgent`}, most urgent first</p>
              <ul className="mt-2 divide-y">
                {attention.slice(0, SHOWN).map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2 text-sm" data-testid="attention-item">
                    <Badge variant={BADGE[i.severity]}>{i.label}</Badge>
                    <Link href={i.href} className="min-w-0 flex-1 truncate hover:underline" title={i.text}>{i.text}</Link>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{i.area}</span>
                  </li>
                ))}
              </ul>
              {attention.length > SHOWN && <p className="mt-2 text-xs text-muted-foreground">and {attention.length - SHOWN} more. Open a service report below for the full picture.</p>}
            </>
          )}
        </section>

        <section aria-labelledby="by-service-heading" className="min-w-0 rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="by-service-heading" className="text-base font-semibold">Records by service</h2>
          {byService.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No records in any service yet.</p>
          ) : (
            <div className="mt-3"><ReportBars rows={byService} label="Records by service" /></div>
          )}
        </section>
      </div>

      <section aria-labelledby="services-heading" className="rounded-2xl border bg-card shadow-panel" data-testid="service-table">
        <div className="px-4 pt-4">
          <h2 id="services-heading" className="text-base font-semibold">Service by service</h2>
          <p className="text-xs text-muted-foreground">The key numbers for each service. Open one for charts, every record and exports.</p>
        </div>
        <div className="relative mt-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Service</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Records</th>
                <th scope="col" className="px-3 py-2 font-medium">Key numbers</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-4 py-2"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map((r) => {
                const Icon = MODULE_ICONS[r.id];
                const status = statusOf(r);
                return (
                  <tr key={r.id} data-testid="service-row">
                    <th scope="row" className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-3">{Icon && <IconSquare icon={Icon} size="sm" />}<span>{r.name}</span></span>
                    </th>
                    <td className="px-3 py-3 text-right tabular-nums">{r.count}</td>
                    <td className="px-3 py-3">
                      {r.count === 0 ? <span className="text-muted-foreground">No {r.noun} yet</span> : (
                        <span className="flex flex-wrap gap-x-4 gap-y-0.5">
                          {r.metrics.slice(0, 3).map((m) => (
                            <span key={m.label} className="whitespace-nowrap"><span className="text-muted-foreground">{m.label}</span> <span className={cn("font-semibold tabular-nums", TONE[m.tone])}>{m.value}</span></span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3"><span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_LABEL[status].className)}>{STATUS_LABEL[status].text}</span></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => onOpen(r.id)} aria-label={`View ${r.name} report`}>View report <ArrowRight /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
