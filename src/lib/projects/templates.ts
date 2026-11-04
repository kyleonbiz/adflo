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
  /** Setup industries this one is suggested for first. Empty means it suits everyone. */
  bestFor?: string[];
  tasks: TemplateTask[];
}

/** Ready-made admin projects. Tasks carry relative due dates so they land sensibly whenever the project starts. */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "client-onboarding",
    name: "Client onboarding",
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
    name: "Employee onboarding",
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
    summary: "Onboard a new vendor with the right paperwork on file.",
    description: "Collect compliance documents and activate the vendor before the first payment.",
    durationDays: 14,
    tasks: [
      { title: "Collect W-9 and contact details", offsetDays: 2 },
      { title: "Request certificate of insurance", offsetDays: 3 },
      { title: "Collect business license copy", offsetDays: 5 },
      { title: "Review contract and payment terms", offsetDays: 7 },
      { title: "Check for duplicate vendor records", offsetDays: 8 },
      { title: "Activate vendor and add to payment system", offsetDays: 10 },
      { title: "File documents and set expiry reminders", offsetDays: 14 },
    ],
  },
  {
    id: "license-renewal",
    name: "License and permit renewal",
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
    name: "Monthly bookkeeping close",
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
    name: "Records cleanup",
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

const tasks = (items: [string, number][]): TemplateTask[] => items.map(([title, offsetDays]) => ({ title, offsetDays }));

/** Starting points for particular kinds of business. They sit in the same list as the general ones. */
PROJECT_TEMPLATES.push(
  { id: "job-closeout", name: "Job closeout", summary: "Finish a job cleanly: punch list, final invoice, paperwork.", description: "Walk the site, fix what is left, collect final paperwork and invoice.", durationDays: 14, bestFor: ["Construction & trades", "Home services"],
    tasks: tasks([["Final walk-through with the customer", 1], ["Complete the punch list", 5], ["Collect lien waivers and warranties", 7], ["Send the final invoice", 8], ["Request a review or reference", 12], ["File job records", 14]]) },
  { id: "inspection-prep", name: "Inspection preparation", summary: "Get ready for a health, fire or licensing inspection.", description: "Check the things inspectors check, fix gaps, and have the paperwork ready.", durationDays: 21, bestFor: ["Restaurant & hospitality", "Healthcare practice", "Education & childcare", "Beauty & wellness", "Manufacturing"],
    tasks: tasks([["Pull last inspection report and fix open items", 3], ["Walk the premises with the inspector's checklist", 7], ["Check that permits and certificates are posted and current", 10], ["Update logs and training records", 14], ["Do a final walk-through", 19], ["File the inspection result", 21]]) },
  { id: "fleet-audit", name: "Fleet compliance audit", summary: "Check every vehicle and driver is legal to run.", description: "Confirm registrations, inspections, insurance and driver paperwork vehicle by vehicle.", durationDays: 30, bestFor: ["Auto & fleet", "Trucking & logistics"],
    tasks: tasks([["List every vehicle and driver", 2], ["Check registrations and tags", 7], ["Check inspections and maintenance", 12], ["Check insurance and driver licenses", 16], ["Fix gaps and book renewals", 24], ["Record the audit", 30]]) },
  { id: "new-matter", name: "New client matter", summary: "Open a legal matter properly: conflicts, engagement, deadlines.", description: "Run the conflict check, sign the engagement and calendar every deadline.", durationDays: 14, bestFor: ["Legal"],
    tasks: tasks([["Run the conflict check", 1], ["Send the engagement letter", 2], ["Collect retainer", 5], ["Calendar court and filing deadlines", 7], ["Request client documents", 10], ["Open the matter folder", 14]]) },
  { id: "tax-season", name: "Tax season prep", summary: "Get clients' documents in before the rush.", description: "Send checklists, chase missing documents and set filing dates for each client.", durationDays: 60, bestFor: ["Accounting & tax"],
    tasks: tasks([["Send document checklists to every client", 3], ["Chase missing documents", 21], ["Confirm engagement letters are signed", 14], ["Decide who needs an extension", 45], ["File returns and extensions", 58], ["Send final copies and invoices", 60]]) },
  { id: "product-launch", name: "Product launch", summary: "Plan a launch with owners and dates.", description: "Settle the offer, prepare materials and run the launch week.", durationDays: 45, bestFor: ["Retail & e-commerce", "Tech & agency", "Manufacturing"],
    tasks: tasks([["Agree the offer and price", 3], ["Prepare listings and materials", 14], ["Order or confirm stock", 21], ["Test checkout and delivery", 30], ["Announce to customers", 38], ["Review the first week", 45]]) },
  { id: "client-kickoff", name: "Client project kickoff", summary: "Start a client project with scope, owners and milestones.", description: "Confirm scope, name an owner on each side and set the first milestones.", durationDays: 14, bestFor: ["Tech & agency", "Professional services"],
    tasks: tasks([["Confirm scope and sign-off", 2], ["Name owners on both sides", 3], ["Set milestones and dates", 5], ["Collect access and assets", 8], ["Hold the kickoff call", 10], ["Send the first status update", 14]]) },
  { id: "enrollment-period", name: "Enrollment period", summary: "Open enrollment, collect forms, confirm places.", description: "Announce dates, collect forms and deposits, and confirm each family.", durationDays: 45, bestFor: ["Education & childcare"],
    tasks: tasks([["Announce dates and fees", 2], ["Send enrollment forms", 5], ["Collect forms and deposits", 25], ["Confirm places and waitlist", 35], ["Send welcome packets", 42], ["Check immunization and emergency forms", 45]]) },
  { id: "line-audit", name: "Production line audit", summary: "Check safety, quality and records on the line.", description: "Walk the line, review logs and close out nonconformances.", durationDays: 21, bestFor: ["Manufacturing"],
    tasks: tasks([["Review open nonconformance reports", 3], ["Check guards, signage and lockout", 7], ["Review maintenance logs", 10], ["Sample parts against spec", 14], ["Close findings with owners", 20], ["Sign off the audit", 21]]) },
);

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
