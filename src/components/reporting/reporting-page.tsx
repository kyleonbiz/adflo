"use client";

import { useCallback, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/components/modules/use-today";
import { buildDashboard } from "@/lib/dashboard/logic";
import { e2eSeed } from "@/lib/e2e-seed";
import { starterForms } from "@/lib/forms/starter-forms";
import type { Contact } from "@/lib/contacts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { License } from "@/lib/licenses/types";
import type { Project } from "@/lib/projects/types";
import type { AdminRequest, Routine } from "@/lib/admin/types";
import type { Submission } from "@/lib/forms/types";
import type { Vendor } from "@/lib/vendors/types";
import { buildReports, type ReportSources } from "@/lib/reporting/logic";
import { cn } from "@/lib/utils";
import { CustomDataReport } from "./custom-data-report";
import { ModuleReportView } from "./module-report-view";
import { Overview } from "./overview";

const OVERVIEW = "overview";
export const CUSTOM = "custom";

/** Records a test injects into every service (see `e2e-seed`); otherwise what the server loaded. */
function withSeeds(src: ReportSources): ReportSources {
  return {
    ...src,
    invoices: e2eSeed<Invoice>("invoices") ?? src.invoices,
    licenses: e2eSeed<License>("licenses") ?? src.licenses,
    projects: e2eSeed<Project>("projects") ?? src.projects,
    vendors: e2eSeed<Vendor>("vendors") ?? src.vendors,
    contacts: e2eSeed<Contact>("contacts") ?? src.contacts,
    requests: e2eSeed<AdminRequest>("requests") ?? src.requests,
    routines: e2eSeed<Routine>("routines") ?? src.routines,
    submissions: e2eSeed<Submission>("submissions") ?? src.submissions,
    forms: src.forms.length > 0 ? src.forms : starterForms(),
  };
}

function Body({ sources, today, view, onView }: { sources: ReportSources; today: string; view: string; onView: (v: string) => void }) {
  const seeded = useMemo(() => withSeeds(sources), [sources]);
  const reports = useMemo(() => buildReports(seeded, today), [seeded, today]);
  const attention = useMemo(() => buildDashboard(seeded, today).items, [seeded, today]);
  const current = reports.find((r) => r.id === view);
  const tabs = [{ id: OVERVIEW, name: "Overview" }, ...reports.map((r) => ({ id: r.id, name: r.name })), { id: CUSTOM, name: "Custom Data" }];
  const active = view === CUSTOM || current ? view : OVERVIEW;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Reports" className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={active === t.id} aria-controls="report-panel"
            onClick={() => onView(t.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="report-panel" aria-labelledby={`tab-${active}`}>
        {active === OVERVIEW && <Overview reports={reports} attention={attention} onOpen={onView} />}
        {current && active === current.id && <ModuleReportView report={current} today={today} />}
        {active === CUSTOM && <CustomDataReport today={today} />}
      </div>
    </div>
  );
}

/**
 * Reporting across the services: an overview, one report per service, and a place to report on a file of
 * your own. `sources` is what the server could read (see `loadReportSources`); `initialView` comes from `?view=`.
 */
export function ReportingPage({ sources, initialView, preview }: { sources: ReportSources; initialView?: string; preview?: string }) {
  const today = useToday();
  const [view, setView] = useState(initialView || OVERVIEW);
  const change = useCallback((v: string) => {
    setView(v);
    try { window.history.replaceState(null, "", v === OVERVIEW ? window.location.pathname : `?view=${encodeURIComponent(v)}`); } catch { /* the address bar is a convenience */ }
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="text-sm text-muted-foreground">See every service at a glance, open a report for any of them, or report on a spreadsheet of your own.</p>
      </div>
      {preview && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>}
      {today ? (
        <Body sources={sources} today={today} view={view} onView={change} />
      ) : (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        </div>
      )}
    </div>
  );
}
