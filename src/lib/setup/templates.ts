import { addDays, addMonths } from "@/lib/dates";
import type { Every } from "@/lib/admin/types";
import type { Category } from "@/lib/admin/types";
import type { FormField, FormTemplate } from "@/lib/forms/types";
import type { License } from "@/lib/licenses/types";
import type { Routine } from "@/lib/admin/types";

interface Base { id: string; module: string; name: string; description: string }

export interface FormTpl extends Base {
  kind: "form";
  approver: string;
  fields: Omit<FormField, "id">[];
  documentTemplate: string;
}
export interface RoutineTpl extends Base {
  kind: "routine";
  category: Category;
  every: Every;
  /** The first run is this many days from the day it is installed. */
  startInDays: number;
}
export interface LicenseTpl extends Base {
  kind: "license";
  items: { name: string; category: License["category"]; issuer: string; termMonths: number; reminderDays: number[]; documents: string[] }[];
}
export type Template = FormTpl | RoutineTpl | LicenseTpl;

const f = (label: string, type: FormField["type"], required = true, options: string[] = []): Omit<FormField, "id"> => ({ label, type, required, options });

/** Everything setup can install. Each kind is read by the module named in `module`. */
export const TEMPLATES: Template[] = [
  {
    id: "form-employee-onboarding", module: "forms", kind: "form", name: "New employee details",
    description: "Collect what you need on a new hire's first day.", approver: "",
    fields: [f("Full name", "text"), f("Personal email", "email"), f("Phone", "text", false), f("Start date", "date"), f("Role", "text"), f("Emergency contact", "text", false), f("W-4 completed", "checkbox", false)],
    documentTemplate: "New employee: {{Full name}}\nRole: {{Role}}\nStart date: {{Start date}}\nEmail: {{Personal email}}\nEmergency contact: {{Emergency contact}}\nW-4 completed: {{W-4 completed}}",
  },
  {
    id: "form-expense-claim", module: "forms", kind: "form", name: "Expense reimbursement",
    description: "Staff claim back money they spent, and a manager approves it.", approver: "Finance manager",
    fields: [f("Employee name", "text"), f("Expense date", "date"), f("Amount", "number"), f("Category", "select", true, ["Travel", "Meals", "Supplies", "Software", "Other"]), f("What was it for?", "longtext"), f("Receipt attached", "checkbox")],
    documentTemplate: "Expense claim from {{Employee name}}\nDate: {{Expense date}}\nAmount: {{Amount}}\nCategory: {{Category}}\nPurpose: {{What was it for?}}\nReceipt attached: {{Receipt attached}}",
  },
  {
    id: "form-client-intake", module: "forms", kind: "form", name: "New client intake",
    description: "The basics for every new client, before work starts.", approver: "",
    fields: [f("Client name", "text"), f("Contact email", "email"), f("Phone", "text", false), f("Service needed", "select", true, ["Bookkeeping", "Admin support", "Document prep", "Project work", "Other"]), f("Anything we should know?", "longtext", false)],
    documentTemplate: "",
  },
  {
    id: "routine-bank-reconciliation", module: "admin", kind: "routine", name: "Reconcile bank statements",
    description: "Match last month's statements to the ledger.", category: "Finance & payments", every: "monthly", startInDays: 5,
  },
  {
    id: "routine-team-agenda", module: "admin", kind: "routine", name: "Send the weekly team agenda",
    description: "Share priorities for the week ahead.", category: "Scheduling", every: "weekly", startInDays: 3,
  },
  {
    id: "routine-subscription-review", module: "admin", kind: "routine", name: "Review software subscriptions",
    description: "Cancel or renew anything that is unused.", category: "Vendors & purchasing", every: "quarterly", startInDays: 30,
  },
  {
    id: "routine-invoice-followup", module: "admin", kind: "routine", name: "Follow up on overdue invoices",
    description: "Chase every invoice past its due date.", category: "Finance & payments", every: "weekly", startInDays: 2,
  },
  {
    id: "licenses-small-business", module: "licenses", kind: "license", name: "Common small-business licenses",
    description: "Four records to fill in with your real numbers and dates.",
    items: [
      { name: "State business license", category: "business", issuer: "Secretary of State", termMonths: 12, reminderDays: [60, 30, 7], documents: ["Annual report", "Renewal fee receipt"] },
      { name: "Sales tax registration", category: "registration", issuer: "Department of Revenue", termMonths: 24, reminderDays: [60, 14], documents: ["Registration certificate"] },
      { name: "General liability insurance", category: "insurance", issuer: "Your insurer", termMonths: 12, reminderDays: [60, 30], documents: ["Certificate of insurance"] },
      { name: "Local business permit", category: "permit", issuer: "City clerk", termMonths: 12, reminderDays: [45, 14], documents: ["Signed application"] },
    ],
  },
];

export const templatesFor = (module: string) => TEMPLATES.filter((t) => t.module === module);
export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
export const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id));

/** Form templates the user installed, in catalogue order. Ids are stable so reinstalling never duplicates. */
export function installedForms(ids: readonly string[]): FormTemplate[] {
  return TEMPLATES.flatMap((t) =>
    t.kind === "form" && ids.includes(t.id)
      ? [{
          id: `tpl-${t.id}`, name: t.name, description: t.description, requiresApproval: t.approver !== "", approver: t.approver,
          documentTemplate: t.documentTemplate, fields: t.fields.map((fld, i) => ({ ...fld, id: `${t.id}-f${i + 1}` })),
        }]
      : [],
  );
}

export function installedRoutines(ids: readonly string[], today: string): Routine[] {
  return TEMPLATES.flatMap((t) =>
    t.kind === "routine" && ids.includes(t.id)
      ? [{ id: `tpl-${t.id}`, title: t.name, description: t.description, category: t.category, every: t.every, nextDueOn: addDays(today, t.startInDays) }]
      : [],
  );
}

/** Starter licenses expire a term from today; the notes ask the user to replace them with real dates. */
export function installedLicenses(ids: readonly string[], today: string): License[] {
  return TEMPLATES.flatMap((t) =>
    t.kind === "license" && ids.includes(t.id)
      ? t.items.map((it, i): License => ({
          id: `tpl-${t.id}-${i + 1}`, name: it.name, category: it.category, issuer: it.issuer, number: "", holder: "",
          issuedOn: today, expiresOn: addMonths(today, it.termMonths), renewalTermMonths: it.termMonths, reminderDays: it.reminderDays,
          stage: "not_started", datesConfirmed: false, notes: "Starter record: enter the real license number and dates.",
          requiredDocuments: it.documents.map((label, j) => ({ id: `tpl-${t.id}-${i + 1}-d${j + 1}`, label, received: false })),
        }))
      : [],
  );
}
