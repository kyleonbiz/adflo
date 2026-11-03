import { addDays, formatDayLong } from "@/lib/dates";
import { formatMoney, invoiceState, summarize as invoiceSummary } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { licenseStatus, needsReview } from "@/lib/licenses/logic";
import type { License } from "@/lib/licenses/types";
import { summarize as projectSummary, taskAlerts } from "@/lib/projects/logic";
import type { Project } from "@/lib/projects/types";
import { summarize as vendorSummary } from "@/lib/vendors/logic";
import type { Vendor } from "@/lib/vendors/types";

/** Everything the dashboard reads. It is empty until the services are stored in the database; fill `loadDashboardSources` for the database. */
export interface DashboardSources {
  invoices: Invoice[];
  licenses: License[];
  projects: Project[];
  vendors: Vendor[];
}

export type Severity = "critical" | "warning" | "info";
export type Area = "Invoices" | "Licenses" | "Tasks";

/** One headline card: a number, where it links, and a one-line status under it. */
export interface Kpi {
  id: "money" | "tasks" | "attention";
  label: string;
  value: string;
  href: string;
  /** The line under the number: what is wrong (`bad`), worth a look (`warn`) or fine (`good`). */
  note: { tone: "good" | "warn" | "bad"; text: string };
}
/** Open work in a service, and how much of it needs attention: one pair of bars in the overview chart. */
export interface WorkloadRow { label: string; open: number; attention: number }
/** How much falls due on one of the next seven days (anything already late counts on today). */
export interface UpcomingDay { day: string; label: string; count: number }
export interface AttentionItem { id: string; area: Area; severity: Severity; label: string; text: string; href: string }
/** Plain data (no functions or dates), so a server component can hand it to the client dashboard. */
export interface DashboardData {
  kpis: Kpi[];
  workload: WorkloadRow[];
  upcoming: UpcomingDay[];
  /** Overall state for the status line: something critical, something to look at, or nothing. */
  status: "attention" | "watch" | "clear";
  items: AttentionItem[];
}

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

function invoiceItems(invoices: Invoice[], today: string, base: string): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const i of invoices) {
    const state = invoiceState(i, today); // once per invoice
    if (state !== "overdue" && state !== "due_today" && state !== "due_soon") continue;
    const overdue = state === "overdue";
    out.push({
      id: `inv-${i.id}`, area: "Invoices", href: `${base}/invoices`,
      severity: overdue ? "critical" : "warning",
      label: overdue ? "Overdue" : state === "due_today" ? "Due today" : "Due soon",
      text: `${i.number} · ${i.client} · ${formatMoney(i.amountCents)}${overdue ? "" : `, due ${formatDayLong(i.dueOn)}`}`,
    });
  }
  return out;
}

function licenseItems(licenses: License[], today: string, base: string): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const l of licenses) {
    const status = licenseStatus(l, today);
    if (status === "active") {
      if (needsReview(l)) {
        out.push({ id: `lic-review-${l.id}`, area: "Licenses", href: `${base}/licenses`, severity: "info", label: "Review", text: `${l.name} needs its details checked` });
      }
      continue;
    }
    const expired = status === "expired";
    const submitted = l.stage === "submitted";
    const open = status === "renewal_window";
    out.push({
      id: `lic-${l.id}`, area: "Licenses", href: `${base}/licenses`,
      severity: submitted ? "info" : open ? "info" : expired ? "critical" : "warning",
      label: submitted ? "Submitted" : expired ? "Expired" : open ? "Renewal open" : "Expiring",
      text: `${l.name} ${expired ? "expired" : "expires"} ${formatDayLong(l.expiresOn)}`,
    });
  }
  return out;
}

/** The numbers and the action list for the dashboard, computed once for a given day. */
export function buildDashboard(src: DashboardSources, today: string, base = "/app"): DashboardData {
  const inv = invoiceSummary(src.invoices, today);
  const proj = projectSummary(src.projects, today);
  const ven = vendorSummary(src.vendors, today);
  const items: AttentionItem[] = [
    ...invoiceItems(src.invoices, today, base),
    ...licenseItems(src.licenses, today, base),
    ...taskAlerts(src.projects, today).map((a): AttentionItem => ({
      id: `task-${a.task.id}`, area: "Tasks", href: `${base}/projects`,
      severity: a.state === "overdue" ? "critical" : "warning",
      label: a.state === "overdue" ? "Overdue" : a.state === "due_today" ? "Due today" : "Due soon",
      text: `${a.task.title} · ${a.projectName}`,
    })),
  ].sort((a, b) => RANK[a.severity] - RANK[b.severity]); // stable: ties keep the order above

  const count = (area: Area) => items.filter((i) => i.area === area).length;
  const workload: WorkloadRow[] = [
    { label: "Invoices", open: src.invoices.filter((i) => i.status === "sent").length, attention: count("Invoices") },
    { label: "Licenses", open: src.licenses.length, attention: count("Licenses") },
    { label: "Vendors", open: src.vendors.filter((v) => v.status !== "inactive" && v.status !== "rejected").length, attention: ven.pendingApproval },
    { label: "Tasks", open: proj.openTasks, attention: count("Tasks") },
  ];

  const plural = (n: number, w: string) => `${n} ${w}`;
  const kpis: Kpi[] = [
    { id: "money", label: "Outstanding invoices", value: formatMoney(inv.outstandingCents), href: `${base}/invoices`,
      note: inv.overdueCount > 0 ? { tone: "bad", text: plural(inv.overdueCount, "overdue") } : { tone: "good", text: "None overdue" } },
    { id: "tasks", label: "Open tasks", value: String(proj.openTasks), href: `${base}/projects`,
      note: proj.overdueTasks > 0 ? { tone: "bad", text: plural(proj.overdueTasks, "overdue") } : { tone: "good", text: "None overdue" } },
    { id: "attention", label: "Needs attention", value: String(items.length), href: `${base}/overview`,
      note: items.some((i) => i.severity === "critical") ? { tone: "bad", text: "Something is late" } : items.length > 0 ? { tone: "warn", text: "Worth a look" } : { tone: "good", text: "All clear" } },
  ];

  return {
    kpis, workload, items,
    upcoming: upcomingLoad(src, today),
    status: items.some((i) => i.severity === "critical") ? "attention" : items.length > 0 ? "watch" : "clear",
  };
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

/** Counts what falls due on each of the next seven days: unpaid invoices, open tasks and license expiries. */
export function upcomingLoad(src: DashboardSources, today: string): UpcomingDay[] {
  const days: UpcomingDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    return { day, label: WEEKDAY[new Date(`${day}T12:00:00Z`).getUTCDay()], count: 0 };
  });
  const last = days[6].day;
  const add = (due: string | null | undefined) => {
    if (!due || due > last) return;
    days[due < today ? 0 : days.findIndex((d) => d.day === due)].count++;
  };
  for (const i of src.invoices) if (i.status === "sent") add(i.dueOn);
  for (const p of src.projects) {
    if (p.status === "completed" || p.status === "on_hold") continue;
    for (const t of p.tasks) if (!t.done) add(t.dueOn);
  }
  for (const l of src.licenses) if (l.expiresOn >= today) add(l.expiresOn);
  return days;
}

/** The calendar day in `timeZone` (an IANA name such as the one Vercel sends), or in UTC when it is missing or invalid. */
export function dayInZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  const iso = (tz?: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try { return iso(timeZone || "UTC"); } catch { return iso("UTC"); }
}
