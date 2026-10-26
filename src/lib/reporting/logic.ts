import { daysBetween } from "@/lib/dates";
import { summarize as adminSummary, isActive, isOverdue } from "@/lib/admin/logic";
import { contactDuplicates, summarize as contactSummary } from "@/lib/contacts/logic";
import type { Contact } from "@/lib/contacts/types";
import type { DashboardSources } from "@/lib/dashboard/logic";
import { formatBytes } from "@/lib/dms/validation";
import { CATEGORY_LABELS, type DocumentRecord } from "@/lib/dms/types";
import { summarize as formSummary } from "@/lib/forms/logic";
import type { FormTemplate, Submission } from "@/lib/forms/types";
import { daysOverdue, formatMoney, invoiceState, summarize as invoiceSummary } from "@/lib/invoices/logic";
import { licenseStatus, missingDocuments, daysLeft, summarize as licenseSummary } from "@/lib/licenses/logic";
import { LICENSE_CATEGORIES, RENEWAL_STAGES } from "@/lib/licenses/types";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { progress, projectHealth, summarize as projectSummary } from "@/lib/projects/logic";
import { PROJECT_STATUSES } from "@/lib/projects/types";
import { STATUS_LABEL as VENDOR_STATUS, onboardingProgress, summarize as vendorSummary } from "@/lib/vendors/logic";

/** Everything the reports read: the dashboard's records plus the contacts, forms and documents. */
export interface ReportSources extends DashboardSources {
  contacts: Contact[];
  forms: FormTemplate[];
  submissions: Submission[];
  documents: DocumentRecord[];
}

export const emptySources = (): ReportSources => ({
  invoices: [], licenses: [], projects: [], vendors: [], requests: [], routines: [], contacts: [], forms: [], submissions: [], documents: [],
});

export type ReportTone = "neutral" | "warning" | "danger";
export interface ReportMetric { label: string; value: string; tone: ReportTone; note?: string }
export interface ReportRow { label: string; value: number; display?: string }
export interface ReportBreakdown { title: string; rows: ReportRow[] }
export interface ReportTable { headers: string[]; rows: (string | number)[][] }

/** Plain data (no functions), so it can cross from a server component to the client. */
export interface ModuleReport {
  id: string;
  name: string;
  href: string;
  /** How many records the report covers. Zero shows the empty state. */
  count: number;
  noun: string;
  metrics: ReportMetric[];
  breakdowns: ReportBreakdown[];
  table: ReportTable;
}

const TOP = 10;
const tone = (n: number, t: ReportTone): ReportTone => (n > 0 ? t : "neutral");

/** Counts items by label, biggest first; `order` pins a fixed order (zero counts left out). */
function tally<T>(items: T[], label: (item: T) => string, order?: string[]): ReportRow[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(label(item), (counts.get(label(item)) ?? 0) + 1);
  const rows = [...counts].map(([l, value]) => ({ label: l, value }));
  if (order) return rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, TOP);
}

/** Sums `amount` by label, biggest first. */
function sumBy<T>(items: T[], label: (item: T) => string, amount: (item: T) => number, display: (n: number) => string): ReportRow[] {
  const sums = new Map<string, number>();
  for (const item of items) sums.set(label(item), (sums.get(label(item)) ?? 0) + amount(item));
  return [...sums].map(([l, value]) => ({ label: l, value, display: display(value) })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, TOP);
}

const label = <T extends { value: string; label: string }>(list: readonly T[], value: string) => list.find((x) => x.value === value)?.label ?? value;

const INVOICE_STATE: Record<string, string> = {
  draft: "Draft", upcoming: "Upcoming", due_soon: "Due soon", due_today: "Due today", overdue: "Overdue", paid: "Paid", void: "Void",
};
const INVOICE_ORDER = ["Overdue", "Due today", "Due soon", "Upcoming", "Draft", "Paid", "Void"];
const LICENSE_STATUS: Record<string, string> = { active: "Active", renewal_window: "Renewal open", expiring: "Expiring", expired: "Expired" };
const LICENSE_ORDER = ["Expired", "Expiring", "Renewal open", "Active"];
const HEALTH: Record<string, string> = { completed: "Completed", on_hold: "On hold", planning: "Planning", late: "Late", at_risk: "At risk", on_track: "On track" };
const HEALTH_ORDER = ["Late", "At risk", "On track", "Planning", "On hold", "Completed"];
const REQUEST_STATUS: Record<string, string> = { pending_approval: "Waiting for approval", open: "Open", in_progress: "In progress", done: "Done", declined: "Declined" };
const REQUEST_ORDER = ["Waiting for approval", "Open", "In progress", "Done", "Declined"];
const SUBMISSION_STATUS: Record<string, string> = { received: "Received", pending: "Pending", approved: "Approved", rejected: "Rejected" };
const SUBMISSION_ORDER = ["Pending", "Received", "Approved", "Rejected"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

function invoices(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const s = invoiceSummary(src.invoices, today);
  const live = src.invoices.filter((i) => i.status !== "void");
  return {
    count: src.invoices.length, noun: "invoices",
    metrics: [
      { label: "Outstanding", value: formatMoney(s.outstandingCents), tone: "neutral" },
      { label: "Overdue", value: String(s.overdueCount), tone: tone(s.overdueCount, "danger"), note: s.overdueCount ? formatMoney(s.overdueCents) : undefined },
      { label: "Due within a week", value: String(s.dueSoonCount), tone: tone(s.dueSoonCount, "warning") },
      { label: "Paid this month", value: formatMoney(s.paidThisMonthCents), tone: "neutral" },
    ],
    breakdowns: [
      { title: "Invoices by status", rows: tally(src.invoices, (i) => INVOICE_STATE[invoiceState(i, today)], INVOICE_ORDER) },
      { title: "Billed by client", rows: sumBy(live, (i) => i.client, (i) => i.amountCents, formatMoney) },
    ],
    table: {
      headers: ["Number", "Client", "Amount", "Issued", "Due", "Status", "Days overdue"],
      rows: src.invoices.map((i) => [i.number, i.client, (i.amountCents / 100).toFixed(2), i.issuedOn, i.dueOn, INVOICE_STATE[invoiceState(i, today)], daysOverdue(i, today)]),
    },
  };
}

function licenses(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const s = licenseSummary(src.licenses, today);
  return {
    count: src.licenses.length, noun: "licenses",
    metrics: [
      { label: "Licenses", value: String(s.total), tone: "neutral" },
      { label: "Expired", value: String(s.expired), tone: tone(s.expired, "danger") },
      { label: "Expiring soon", value: String(s.expiring), tone: tone(s.expiring, "warning") },
      { label: "Missing documents", value: String(s.missingDocuments), tone: tone(s.missingDocuments, "warning") },
    ],
    breakdowns: [
      { title: "Licenses by status", rows: tally(src.licenses, (l) => LICENSE_STATUS[licenseStatus(l, today)], LICENSE_ORDER) },
      { title: "Licenses by type", rows: tally(src.licenses, (l) => label(LICENSE_CATEGORIES, l.category)) },
    ],
    table: {
      headers: ["Name", "Type", "Issuer", "Expires", "Days left", "Status", "Renewal", "Missing documents"],
      rows: [...src.licenses].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn)).map((l) => [
        l.name, label(LICENSE_CATEGORIES, l.category), l.issuer, l.expiresOn, daysLeft(l, today), LICENSE_STATUS[licenseStatus(l, today)],
        label(RENEWAL_STAGES, l.stage), missingDocuments(l),
      ]),
    },
  };
}

function vendors(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const s = vendorSummary(src.vendors, today);
  return {
    count: src.vendors.length, noun: "vendors",
    metrics: [
      { label: "Vendors", value: String(s.vendors), tone: "neutral" },
      { label: "Approved", value: String(s.approved), tone: "neutral" },
      { label: "Awaiting approval", value: String(s.pendingApproval), tone: tone(s.pendingApproval, "warning") },
      { label: "Document issues", value: String(s.documentIssues), tone: tone(s.documentIssues, "warning") },
    ],
    breakdowns: [
      { title: "Vendors by status", rows: tally(src.vendors, (v) => VENDOR_STATUS[v.status], Object.values(VENDOR_STATUS)) },
      { title: "Vendors by category", rows: tally(src.vendors, (v) => v.category) },
    ],
    table: {
      headers: ["Name", "Category", "Status", "Contact", "Email", "Required documents received", "Required documents"],
      rows: src.vendors.map((v) => { const p = onboardingProgress(v, today); return [v.name, v.category, VENDOR_STATUS[v.status], v.contactName, v.email, p.done, p.total]; }),
    },
  };
}

function contacts(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const s = contactSummary(src.contacts, today, contactDuplicates(src.contacts));
  return {
    count: src.contacts.length, noun: "contacts",
    metrics: [
      { label: "Contacts", value: String(s.total), tone: "neutral" },
      { label: "Possible duplicates", value: String(s.duplicatePairs), tone: tone(s.duplicatePairs, "warning") },
      { label: "Missing email", value: String(s.missingEmail), tone: tone(s.missingEmail, "warning") },
      { label: "Not contacted in 90 days", value: String(s.stale), tone: tone(s.stale, "warning") },
    ],
    breakdowns: [
      { title: "Contacts by category", rows: tally(src.contacts, (c) => c.category) },
      { title: "Contacts by company", rows: tally(src.contacts.filter((c) => c.company), (c) => c.company) },
    ],
    table: {
      headers: ["Name", "Company", "Category", "Email", "Phone", "Last contacted"],
      rows: src.contacts.map((c) => [c.name, c.company, c.category, c.email, c.phone, c.lastContacted]),
    },
  };
}

function projects(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const s = projectSummary(src.projects, today);
  const open = src.projects.filter((p) => p.status !== "completed" && p.status !== "on_hold").flatMap((p) => p.tasks.filter((t) => !t.done));
  return {
    count: src.projects.length, noun: "projects",
    metrics: [
      { label: "Active projects", value: String(s.activeProjects), tone: "neutral" },
      { label: "Open tasks", value: String(s.openTasks), tone: "neutral" },
      { label: "Overdue tasks", value: String(s.overdueTasks), tone: tone(s.overdueTasks, "danger") },
      { label: "Done this month", value: String(s.completedThisMonth), tone: "neutral" },
    ],
    breakdowns: [
      { title: "Projects by health", rows: tally(src.projects, (p) => HEALTH[projectHealth(p, today)], HEALTH_ORDER) },
      { title: "Projects by status", rows: tally(src.projects, (p) => label(PROJECT_STATUSES, p.status), PROJECT_STATUSES.map((x) => x.label)) },
      { title: "Open tasks by person", rows: tally(open, (t) => t.assignee || "Unassigned") },
    ],
    table: {
      headers: ["Project", "Client", "Status", "Health", "Tasks done", "Tasks", "Due"],
      rows: src.projects.map((p) => { const g = progress(p); return [p.name, p.client, label(PROJECT_STATUSES, p.status), HEALTH[projectHealth(p, today)], g.done, g.total, p.dueOn]; }),
    },
  };
}

function forms(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const s = formSummary(src.forms, src.submissions, today);
  const names = new Map(src.forms.map((f) => [f.id, f.name]));
  const mine = src.submissions.filter((x) => names.has(x.formId));
  return {
    count: mine.length, noun: "submissions",
    metrics: [
      { label: "Forms", value: String(s.forms), tone: "neutral" },
      { label: "Submissions", value: String(s.submissions), tone: "neutral" },
      { label: "Waiting for approval", value: String(s.pending), tone: tone(s.pending, "warning") },
      { label: "Decided this month", value: String(s.decidedThisMonth), tone: "neutral" },
    ],
    breakdowns: [
      { title: "Submissions by status", rows: tally(mine, (x) => SUBMISSION_STATUS[x.status], SUBMISSION_ORDER) },
      { title: "Submissions by form", rows: tally(mine, (x) => names.get(x.formId)!) },
    ],
    table: {
      headers: ["Form", "Submitted on", "Submitted by", "Status", "Decided by", "Decided on"],
      rows: [...mine].sort((a, b) => b.submittedOn.localeCompare(a.submittedOn)).map((x) => [names.get(x.formId)!, x.submittedOn, x.submittedBy, SUBMISSION_STATUS[x.status], x.decidedBy ?? "", x.decidedOn ?? ""]),
    },
  };
}

function admin(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const s = adminSummary(src.requests, src.routines, today);
  return {
    count: src.requests.length, noun: "requests",
    metrics: [
      { label: "Open requests", value: String(s.open), tone: "neutral" },
      { label: "Waiting for approval", value: String(s.pendingApproval), tone: tone(s.pendingApproval, "warning") },
      { label: "Overdue", value: String(s.overdue), tone: tone(s.overdue, "danger") },
      { label: "Recurring tasks due", value: String(s.routinesDue), tone: tone(s.routinesDue, "warning") },
    ],
    breakdowns: [
      { title: "Requests by status", rows: tally(src.requests, (r) => REQUEST_STATUS[r.status], REQUEST_ORDER) },
      { title: "Requests by category", rows: tally(src.requests, (r) => r.category) },
      { title: "Active requests by priority", rows: tally(src.requests.filter(isActive), (r) => cap(r.priority), ["High", "Normal", "Low"]) },
    ],
    table: {
      headers: ["Title", "Category", "Priority", "Status", "Requester", "Due", "Overdue", "Created"],
      rows: src.requests.map((r) => [r.title, r.category, cap(r.priority), REQUEST_STATUS[r.status], r.requester, r.dueOn ?? "", isOverdue(r, today) ? "Yes" : "", r.createdOn]),
    },
  };
}

const EXPIRING_DOC_DAYS = 30;

function documents(src: ReportSources, today: string): Omit<ModuleReport, "id" | "name" | "href"> {
  const docs = src.documents.filter((d) => !d.deletedAt && d.status === "ready");
  const expiring = docs.filter((d) => d.expiresAt && daysBetween(today, day(d.expiresAt)) <= EXPIRING_DOC_DAYS);
  const expired = expiring.filter((d) => day(d.expiresAt) < today).length;
  return {
    count: docs.length, noun: "documents",
    metrics: [
      { label: "Documents", value: String(docs.length), tone: "neutral" },
      { label: "Storage used", value: formatBytes(docs.reduce((n, d) => n + d.sizeBytes, 0)), tone: "neutral" },
      { label: "Expiring in 30 days", value: String(expiring.length - expired), tone: tone(expiring.length - expired, "warning") },
      { label: "Expired", value: String(expired), tone: tone(expired, "danger") },
    ],
    breakdowns: [
      { title: "Documents by type", rows: tally(docs, (d) => CATEGORY_LABELS[d.category]) },
      { title: "Uploaded by", rows: tally(docs, (d) => d.uploadedByName) },
    ],
    table: {
      headers: ["Name", "Type", "Size", "Uploaded by", "Uploaded", "Expires"],
      rows: docs.map((d) => [d.displayName, CATEGORY_LABELS[d.category], formatBytes(d.sizeBytes), d.uploadedByName, day(d.createdAt), day(d.expiresAt)]),
    },
  };
}

const BUILDERS: Partial<Record<string, (src: ReportSources, today: string) => Omit<ModuleReport, "id" | "name" | "href">>> = {
  documents, invoices, licenses, vendors, crm: contacts, projects, forms, admin,
};

/** One report per module that holds records, in catalogue order. */
export function buildReports(src: ReportSources, today: string, base: "/app" = "/app"): ModuleReport[] {
  return MODULES.flatMap((m) => {
    const build = BUILDERS[m.id];
    const href = moduleHref(m, base);
    return build && href ? [{ id: m.id, name: m.name, href, ...build(src, today) }] : [];
  });
}
