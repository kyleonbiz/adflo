export type ModuleStatus = "available" | "planned";

export interface PlatformModule {
  id: string;
  number: string;
  name: string;
  summary: string;
  /** Path segment under /app (or /demo). Only set for modules that exist. */
  slug?: string;
  status: ModuleStatus;
}

/** The eleven service modules of the client portal, in catalogue order. */
export const MODULES: readonly PlatformModule[] = [
  { id: "documents", number: "01", name: "Documents", slug: "documents", status: "available",
    summary: "Upload, organize and search files; versioning, sharing and an audit trail." },
  { id: "invoices", number: "02", name: "Invoices", slug: "invoices", status: "available",
    summary: "Invoice tracking, recurring schedules, due-date reminders and overdue alerts." },
  { id: "licenses", number: "03", name: "Licenses & Renewals", slug: "licenses", status: "available",
    summary: "Track licenses and expiry dates, collect required documents, get renewal reminders." },
  { id: "vendors", number: "04", name: "Vendors", slug: "vendors", status: "available",
    summary: "Supplier profiles, intake forms, document collection and approval routing." },
  { id: "crm", number: "05", name: "CRM & Data", slug: "contacts", status: "available",
    summary: "Import contacts, detect duplicates, validate fields and export clean data." },
  { id: "projects", number: "06", name: "Projects", slug: "projects", status: "available",
    summary: "Projects, tasks, recurring work, deadlines and status reports." },
  { id: "forms", number: "07", name: "Forms & Paperwork", slug: "forms", status: "available",
    summary: "Reusable forms, submission tracking, document generation and approvals." },
  { id: "reporting", number: "08", name: "Data Entry & Reporting", slug: "reporting", status: "available",
    summary: "Turn raw files into organized records and scheduled reports." },
  { id: "admin", number: "09", name: "Admin Support", slug: "admin", status: "available",
    summary: "Requests, recurring tasks and reminders in one place." },
  { id: "file-reset", number: "10", name: "Business File Reset", status: "planned",
    summary: "Guided cleanup: duplicates, folder structure and filenames, with preview and approval." },
  { id: "setup", number: "11", name: "Back Office Setup", status: "planned",
    summary: "Guided onboarding: pick modules, import data and configure recurring workflows." },
];

/** Where a module lives. `base` is "/app" for the signed-in workspace, "/demo" for the public demo. */
export function moduleHref(m: PlatformModule, base: "/app" | "/demo"): string | null {
  if (m.status !== "available" || !m.slug) return null;
  // The documents module is /app itself; its public demo is the workspace on the home page.
  if (m.id === "documents") return base === "/app" ? "/app" : "/";
  return `${base}/${m.slug}`;
}
