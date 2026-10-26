import { addDays } from "@/lib/dates";
import type { Task, TaskRepeat } from "./types";

export interface TemplateTask {
  title: string;
  /** Days after the project's start date that the task is due. */
  offsetDays: number;
  repeat?: TaskRepeat;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  /** One line shown under the picker. */
  summary: string;
  description: string;
  /** Days from the start date to the project's due date. */
  durationDays: number;
  tasks: TemplateTask[];
}

/** Ready-made admin projects. Tasks carry relative due dates so they land sensibly whenever the project starts. */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "client-onboarding",
    name: "Client Onboarding",
    summary: "Welcome a new client and get their records and access set up.",
    description: "Set up the client's workspace, collect their files and train their team.",
    durationDays: 30,
    tasks: [
      { title: "Send welcome email and intake questionnaire", offsetDays: 1 },
      { title: "Hold kickoff call", offsetDays: 3 },
      { title: "Collect existing files and records", offsetDays: 7 },
      { title: "Create client folders and naming conventions", offsetDays: 10 },
      { title: "Set up user accounts and permissions", offsetDays: 12 },
      { title: "Import contacts, vendors and records", offsetDays: 16 },
      { title: "Configure invoice and document templates", offsetDays: 20 },
      { title: "Train the client's team", offsetDays: 25 },
      { title: "Weekly check-in", offsetDays: 7, repeat: "weekly" },
      { title: "Hand over and collect feedback", offsetDays: 30 },
    ],
  },
  {
    id: "employee-onboarding",
    name: "Employee Onboarding",
    summary: "Paperwork, access and first-week setup for a new hire.",
    description: "Complete hiring paperwork, set up accounts and equipment, and plan the first 30 days.",
    durationDays: 30,
    tasks: [
      { title: "Send offer letter and collect signed copy", offsetDays: 0 },
      { title: "Collect tax and payroll forms", offsetDays: 2 },
      { title: "Verify work eligibility documents", offsetDays: 3 },
      { title: "Order equipment and create accounts", offsetDays: 3 },
      { title: "Add to payroll and benefits", offsetDays: 7 },
      { title: "Share handbook and policies for acknowledgement", offsetDays: 7 },
      { title: "First-week orientation and introductions", offsetDays: 7 },
      { title: "30-day check-in", offsetDays: 30 },
    ],
  },
  {
    id: "vendor-onboarding",
    name: "Vendor Onboarding",
    summary: "Approve a new vendor with the right paperwork on file.",
    description: "Collect compliance documents and approve the vendor before the first payment.",
    durationDays: 14,
    tasks: [
      { title: "Collect W-9 and contact details", offsetDays: 2 },
      { title: "Request certificate of insurance", offsetDays: 3 },
      { title: "Collect business license copy", offsetDays: 5 },
      { title: "Review contract and payment terms", offsetDays: 7 },
      { title: "Check for duplicate vendor records", offsetDays: 8 },
      { title: "Approve vendor and add to payment system", offsetDays: 10 },
      { title: "File documents and set expiry reminders", offsetDays: 14 },
    ],
  },
  {
    id: "license-renewal",
    name: "License And Permit Renewal",
    summary: "Renew expiring licenses, permits and insurance on time.",
    description: "Audit what expires, file renewals and keep copies in the right folders.",
    durationDays: 45,
    tasks: [
      { title: "List every license, permit and insurance policy with expiry dates", offsetDays: 3 },
      { title: "Confirm renewal fees and requirements", offsetDays: 7 },
      { title: "Gather supporting documents", offsetDays: 14 },
      { title: "Submit renewal applications", offsetDays: 21 },
      { title: "Pay renewal fees", offsetDays: 22 },
      { title: "Follow up on pending applications", offsetDays: 35 },
      { title: "File new certificates and update expiry dates", offsetDays: 45 },
    ],
  },
  {
    id: "monthly-close",
    name: "Monthly Bookkeeping Close",
    summary: "A repeatable month-end checklist.",
    description: "Reconcile accounts, chase missing receipts and send the monthly summary.",
    durationDays: 10,
    tasks: [
      { title: "Collect bank and card statements", offsetDays: 1 },
      { title: "Chase missing receipts and invoices", offsetDays: 3 },
      { title: "Reconcile bank and card accounts", offsetDays: 5 },
      { title: "Review unpaid and overdue invoices", offsetDays: 6 },
      { title: "Record adjusting entries", offsetDays: 7 },
      { title: "Review reports for errors", offsetDays: 8 },
      { title: "Send monthly summary to the owner", offsetDays: 10 },
    ],
  },
  {
    id: "records-cleanup",
    name: "Records Cleanup",
    summary: "Tidy files, remove duplicates and fix naming.",
    description: "Standardize file names, remove duplicates and archive what is no longer needed.",
    durationDays: 30,
    tasks: [
      { title: "Scope what needs cleaning and agree the folder structure", offsetDays: 3 },
      { title: "Export the current contact and vendor lists", offsetDays: 5 },
      { title: "Deduplicate contacts and vendors", offsetDays: 12 },
      { title: "Rename files to the standard convention", offsetDays: 18 },
      { title: "Archive records past their retention period", offsetDays: 24 },
      { title: "Spot-check a sample and fix issues", offsetDays: 28 },
      { title: "Share the new structure with the team", offsetDays: 30 },
    ],
  },
];

export const templateById = (id: string) => PROJECT_TEMPLATES.find((t) => t.id === id);

/** The project due date a template suggests for a given start date. */
export const templateDueOn = (template: ProjectTemplate, startOn: string) => addDays(startOn, template.durationDays);

/** Turns chosen template items into tasks, dated from the project's start. */
export function buildTasks(items: TemplateTask[], startOn: string, newId: () => string): Task[] {
  return items.map((item) => ({
    id: newId(),
    title: item.title,
    assignee: "",
    dueOn: addDays(startOn, item.offsetDays),
    repeat: item.repeat ?? "none",
    done: false,
    doneOn: null,
    followUpId: null,
  }));
}
