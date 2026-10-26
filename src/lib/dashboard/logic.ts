import { formatDayLong } from "@/lib/dates";
import { notifications, summarize as adminSummary } from "@/lib/admin/logic";
import type { AdminRequest, Routine } from "@/lib/admin/types";
import { formatMoney, invoiceState, summarize as invoiceSummary } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { licenseStatus, summarize as licenseSummary } from "@/lib/licenses/logic";
import type { License } from "@/lib/licenses/types";
import { summarize as projectSummary, taskAlerts } from "@/lib/projects/logic";
import type { Project } from "@/lib/projects/types";
import { summarize as vendorSummary } from "@/lib/vendors/logic";
import type { Vendor } from "@/lib/vendors/types";

/** Everything the dashboard reads. Today it comes from sample data; swap `loadDashboardSources` for the database. */
export interface DashboardSources {
  invoices: Invoice[];
  licenses: License[];
  projects: Project[];
  vendors: Vendor[];
  requests: AdminRequest[];
  routines: Routine[];
}

export type Severity = "critical" | "warning" | "info";
export type Area = "Invoices" | "Licenses" | "Projects" | "Admin";
export type Tone = "neutral" | "warning" | "danger";

export interface Tile { id: string; label: string; value: string; href: string; tone: Tone }
export interface TileGroup { title: string; tiles: Tile[] }
export interface AttentionItem { id: string; area: Area; severity: Severity; label: string; text: string; href: string }
/** Plain data (no functions or dates), so a server component can hand it to the client dashboard. */
export interface DashboardData { groups: TileGroup[]; items: AttentionItem[] }

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
    if (status === "active") continue;
    const expired = status === "expired";
    out.push({
      id: `lic-${l.id}`, area: "Licenses", href: `${base}/licenses`,
      severity: expired ? "critical" : "warning",
      label: expired ? "Expired" : "Expiring",
      text: `${l.name} ${expired ? "expired" : "expires"} ${formatDayLong(l.expiresOn)}`,
    });
  }
  return out;
}

/** The numbers and the action list for the dashboard, computed once for a given day. */
export function buildDashboard(src: DashboardSources, today: string, base = "/app"): DashboardData {
  const inv = invoiceSummary(src.invoices, today);
  const lic = licenseSummary(src.licenses, today);
  const proj = projectSummary(src.projects, today);
  const ven = vendorSummary(src.vendors, today);
  const adm = adminSummary(src.requests, src.routines, today);
  const tone = (n: number, t: Tone): Tone => (n > 0 ? t : "neutral");

  const groups: TileGroup[] = [
    { title: "Money", tiles: [
      { id: "outstanding", label: "Outstanding invoices", value: formatMoney(inv.outstandingCents), href: `${base}/invoices`, tone: "neutral" },
      { id: "overdue-invoices", label: "Overdue invoices", value: String(inv.overdueCount), href: `${base}/invoices`, tone: tone(inv.overdueCount, "danger") },
    ] },
    { title: "Compliance", tiles: [
      { id: "licenses", label: "Licenses expiring or expired", value: String(lic.expiring + lic.expired), href: `${base}/licenses`, tone: tone(lic.expiring + lic.expired, "warning") },
      { id: "vendors", label: "Vendors awaiting approval", value: String(ven.pendingApproval), href: `${base}/vendors`, tone: tone(ven.pendingApproval, "warning") },
    ] },
    { title: "Work", tiles: [
      { id: "tasks", label: "Open project tasks", value: String(proj.openTasks), href: `${base}/projects`, tone: "neutral" },
      { id: "overdue-tasks", label: "Overdue tasks", value: String(proj.overdueTasks), href: `${base}/projects`, tone: tone(proj.overdueTasks, "danger") },
      { id: "requests", label: "Open requests", value: String(adm.open), href: `${base}/admin`, tone: "neutral" },
      { id: "approvals", label: "Waiting for approval", value: String(adm.pendingApproval), href: `${base}/admin`, tone: tone(adm.pendingApproval, "warning") },
    ] },
  ];

  const items: AttentionItem[] = [
    ...invoiceItems(src.invoices, today, base),
    ...licenseItems(src.licenses, today, base),
    ...taskAlerts(src.projects, today).map((a): AttentionItem => ({
      id: `task-${a.task.id}`, area: "Projects", href: `${base}/projects`,
      severity: a.state === "overdue" ? "critical" : "warning",
      label: a.state === "overdue" ? "Overdue" : a.state === "due_today" ? "Due today" : "Due soon",
      text: `${a.task.title} · ${a.projectName}`,
    })),
    ...notifications(src.requests, src.routines, today).map((n): AttentionItem => ({
      id: `adm-${n.id}`, area: "Admin", href: `${base}/admin`, severity: n.severity,
      label: n.severity === "critical" ? "Overdue" : n.severity === "warning" ? "Due today" : "Heads up",
      text: n.message,
    })),
  ].sort((a, b) => RANK[a.severity] - RANK[b.severity]); // stable: ties keep the order above

  return { groups, items };
}

/** The calendar day in `timeZone` (an IANA name such as the one Vercel sends), or in UTC when it is missing or invalid. */
export function dayInZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  const iso = (tz?: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try { return iso(timeZone || "UTC"); } catch { return iso("UTC"); }
}
