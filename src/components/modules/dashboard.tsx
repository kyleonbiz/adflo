"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, CalendarClock, FolderKanban, Inbox, Receipt, ShieldCheck, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { TodayTodos } from "@/components/modules/today-todos";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { formatMoney, invoiceState, needsAttention as invoicesNeedingAction, summarize as invoiceSummary } from "@/lib/invoices/logic";
import { sampleInvoices } from "@/lib/invoices/sample-data";
import { licenseStatus, summarize as licenseSummary } from "@/lib/licenses/logic";
import { sampleLicenses } from "@/lib/licenses/sample-data";
import { summarize as projectSummary, taskAlerts } from "@/lib/projects/logic";
import { sampleProjects } from "@/lib/projects/sample-data";
import { summarize as vendorSummary } from "@/lib/vendors/logic";
import { sampleVendors } from "@/lib/vendors/sample-data";
import { notifications, summarize as adminSummary } from "@/lib/admin/logic";
import { sampleRequests, sampleRoutines } from "@/lib/admin/sample-data";

type Severity = "critical" | "warning" | "info";
interface Item { id: string; severity: Severity; text: string; href: string; area: string }

const BADGE = { critical: "danger", warning: "warning", info: "default" } as const;
const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * The signed-in landing page: headline numbers from each service and one list of what needs action today.
 * Like the service pages it runs on sample data until the database is connected.
 */
export function Dashboard({ base }: { base: "/app" }) {
  const today = useToday();
  const data = useMemo(() => {
    if (!today) return null;
    const invoices = sampleInvoices(today);
    const licenses = sampleLicenses(today);
    const projects = sampleProjects(today);
    const vendors = sampleVendors(today);
    const requests = sampleRequests(today);
    const routines = sampleRoutines(today);

    const items: Item[] = [
      ...invoicesNeedingAction(invoices, today).map((i): Item => ({
        id: `inv-${i.id}`, area: "Invoices", href: `${base}/invoices`,
        severity: invoiceState(i, today) === "overdue" ? "critical" : "warning",
        text: `${i.number} · ${i.client} · ${formatMoney(i.amountCents)} ${invoiceState(i, today) === "overdue" ? "overdue" : `due ${formatDayLong(i.dueOn)}`}`,
      })),
      ...licenses.filter((l) => licenseStatus(l, today) !== "active").map((l): Item => ({
        id: `lic-${l.id}`, area: "Licenses", href: `${base}/licenses`,
        severity: licenseStatus(l, today) === "expired" ? "critical" : "warning",
        text: `${l.name} ${licenseStatus(l, today) === "expired" ? "expired" : "expires"} ${formatDayLong(l.expiresOn)}`,
      })),
      ...taskAlerts(projects, today).map((a): Item => ({
        id: `task-${a.task.id}`, area: "Projects", href: `${base}/projects`,
        severity: a.state === "overdue" ? "critical" : "warning",
        text: `${a.task.title} · ${a.projectName} ${a.state === "overdue" ? "is overdue" : a.state === "due_today" ? "is due today" : "is due soon"}`,
      })),
      ...notifications(requests, routines, today).map((n): Item => ({
        id: `adm-${n.id}`, area: "Admin", href: `${base}/admin`, severity: n.severity, text: n.message,
      })),
    ].sort((a, b) => RANK[a.severity] - RANK[b.severity]);

    return {
      items,
      inv: invoiceSummary(invoices, today),
      lic: licenseSummary(licenses, today),
      proj: projectSummary(projects, today),
      ven: vendorSummary(vendors, today),
      adm: adminSummary(requests, routines, today),
    };
  }, [today, base]);

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-48" />
      </div>
    );
  }
  const { items, inv, lic, proj, ven, adm } = data;

  return (
    <div className="space-y-5" data-testid="dashboard">
      {today && <TodayTodos today={today} />}
      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={Receipt} label="Outstanding invoices" value={formatMoney(inv.outstandingCents)} tone="text-primary" />
        <SummaryTile icon={AlertTriangle} label="Overdue invoices" value={inv.overdueCount} tone="text-red-600" />
        <SummaryTile icon={ShieldCheck} label="Licenses expiring or expired" value={lic.expiring + lic.expired} tone="text-amber-600" />
        <SummaryTile icon={FolderKanban} label="Open project tasks" value={proj.openTasks} tone="text-primary" />
        <SummaryTile icon={CalendarClock} label="Overdue tasks" value={proj.overdueTasks} tone="text-red-600" />
        <SummaryTile icon={Store} label="Vendors awaiting approval" value={ven.pendingApproval} tone="text-amber-600" />
        <SummaryTile icon={Inbox} label="Open requests" value={adm.open} tone="text-primary" />
        <SummaryTile icon={Inbox} label="Waiting for approval" value={adm.pendingApproval} tone="text-amber-600" />
      </section>

      <section aria-labelledby="attention-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h2 id="attention-heading" className="text-base font-semibold">Needs your attention</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">You are all caught up.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {items.slice(0, 8).map((it) => (
              <li key={it.id}>
                <Link href={it.href} className="flex items-center gap-3 py-2.5 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                  <Badge variant={BADGE[it.severity]}>{it.area}</Badge>
                  <span className="min-w-0 flex-1 truncate">{it.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
