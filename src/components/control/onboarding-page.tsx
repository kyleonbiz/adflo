"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, Hourglass, Plus } from "lucide-react";
import { SummaryTile } from "@/components/modules/summary-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STALLED_AFTER_DAYS, summarizeOnboarding, type OnboardingRow } from "@/lib/control/onboarding";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const FILTERS = ["progress", "stalled", "complete", "all"] as const;
type Filter = (typeof FILTERS)[number];
const LABEL: Record<Filter, string> = { progress: "In progress", stalled: "Stalled", complete: "Complete", all: "All" };

/** Every client's setup progress in one list, so the ones that are stuck stand out. Each row opens the client's profile. */
export function OnboardingPage({ rows, canAdd, sample }: { rows: OnboardingRow[]; canAdd: boolean; sample?: boolean }) {
  const [filter, setFilter] = useState<Filter>("progress");
  const summary = useMemo(() => summarizeOnboarding(rows), [rows]);
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "progress" ? !r.complete : filter === "stalled" ? r.stalled : r.complete));
  const count = (f: Filter) => (f === "all" ? rows.length : f === "progress" ? summary.inProgress : f === "stalled" ? summary.stalled : summary.complete);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">Where each new client is in getting set up. Open a client to work through their steps.</p>
        </div>
        {canAdd && <Button asChild><Link href="/control/clients"><Plus /> Add a client</Link></Button>}
      </div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample clients.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile icon={Hourglass} label="Being set up" value={summary.inProgress} tone="text-sky-600" />
        <SummaryTile icon={AlertTriangle} label={`Stalled (over ${STALLED_AFTER_DAYS} days)`} value={summary.stalled} tone={summary.stalled ? "text-red-600" : "text-emerald-600"} />
        <SummaryTile icon={ClipboardList} label="Not started" value={summary.notStarted} tone="text-amber-600" />
        <SummaryTile icon={CheckCircle2} label="Fully set up" value={summary.complete} tone="text-emerald-600" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={cn("h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === f ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
            {LABEL[f]} {count(f)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-panel">
          <p className="font-medium">{rows.length === 0 ? "No clients to set up yet" : filter === "stalled" ? "Nothing is stalled" : "No clients here"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length === 0 ? "Add a client and they will appear here with their onboarding steps." : "Try another filter."}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-panel">
          {shown.map((r) => (
            <li key={r.client.id}>
              <Link href={`/control/clients/${r.client.id}#onboarding`} className="grid gap-x-4 gap-y-2 px-4 py-3.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.client.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={r.client.status} />
                    <span>{r.daysSinceStart === 0 ? "Started today" : `Started ${r.daysSinceStart} ${r.daysSinceStart === 1 ? "day" : "days"} ago`}</span>
                    {r.stalled && <Badge variant="danger">Stalled</Badge>}
                  </p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"><span>Progress</span><span className="tabular-nums">{r.done} of {r.total}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${r.client.name} onboarding`} aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.done}>
                    <div className={cn("h-full rounded-full", r.complete ? "bg-emerald-500" : r.stalled ? "bg-red-500" : "bg-primary")} style={{ width: `${(r.done / r.total) * 100}%` }} />
                  </div>
                </div>
                <p className="min-w-0 text-sm">{r.complete ? <span className="text-emerald-700">All steps done</span> : <><span className="text-muted-foreground">Next: </span>{r.next}</>}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
