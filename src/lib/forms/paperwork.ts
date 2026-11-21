import { layoutTemplate } from "./layout";
import type { FormField, FormTemplate } from "./types";

export const INDUSTRIES = [
  { id: "general", label: "Any business" },
  { id: "construction", label: "Construction and trades" },
  { id: "food", label: "Restaurant or food service" },
  { id: "vehicle", label: "Vehicles and fleet" },
  { id: "professional", label: "Professional services" },
  { id: "realestate", label: "Real estate" },
  { id: "health", label: "Healthcare" },
  { id: "retail", label: "Retail" },
  { id: "beauty", label: "Beauty and wellness" },
  { id: "childcare", label: "Education and childcare" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "legal", label: "Legal" },
  { id: "accounting", label: "Accounting and tax" },
] as const;
export type IndustryId = (typeof INDUSTRIES)[number]["id"];

export interface Paperwork {
  industry: IndustryId;
  /** What it is for, in a few words, shown beside the name. */
  use: string;
  /** Forms that tend to be filled in again and again (a daily log, a job report). */
  repeats?: boolean;
  form: FormTemplate;
}

let n = 0;
const f = (label: string, type: FormField["type"] = "text", required = true, options: string[] = []): FormField => ({ id: `pw-f${++n}`, label, type, required, options });

function paper(
  industry: IndustryId, id: string, name: string, use: string, fields: FormField[],
  opts: { approver?: string; repeats?: boolean; doc?: string } = {},
): Paperwork {
  return {
    industry, use, repeats: opts.repeats,
    form: {
      id: `pw-${id}`, name, description: use, fields, sentCount: 0,
      documentTemplate: opts.doc ?? layoutTemplate(use, fields),
    },
  };
}

export const PAPERWORK: readonly Paperwork[] = [
  paper("general", "w9-request", "W-9 request", "Ask a vendor or contractor for their tax details", [
    f("Legal name"), f("Business name", "text", false), f("Tax classification", "select", true, ["Individual", "LLC", "S corporation", "C corporation", "Partnership"]),
    f("Mailing address", "longtext"), f("Email", "email"),
  ]),
  paper("general", "employee-onboarding", "New employee information", "Basic details for a new hire's file", [
    f("Full name"), f("Job title"), f("Start date", "date"), f("Phone"), f("Emergency contact"), f("Emergency contact phone"),
  ], { approver: "Operations manager" }),
  paper("general", "time-off", "Time-off request", "Ask for leave and route it for approval", [
    f("Employee name"), f("First day off", "date"), f("Last day off", "date"), f("Type", "select", true, ["Vacation", "Sick", "Personal"]), f("Reason", "longtext", false),
  ], { approver: "Manager" }),
  paper("general", "expense", "Expense reimbursement", "Get paid back for something you bought for the business", [
    f("Employee name"), f("Date of purchase", "date"), f("Amount", "number"), f("What was it for", "longtext"), f("Receipt attached", "checkbox", false),
  ], { approver: "Manager", repeats: true }),
  paper("general", "purchase-request", "Purchase request", "Get approval before spending", [
    f("Requested by"), f("Item or service"), f("Vendor", "text", false), f("Estimated cost", "number"), f("Why it is needed", "longtext"),
  ], { approver: "Owner" }),
  paper("general", "incident", "Incident report", "Write down what happened, while it is fresh", [
    f("Reported by"), f("Date of incident", "date"), f("Where it happened"), f("What happened", "longtext"), f("Anyone hurt", "checkbox", false), f("Action taken", "longtext", false),
  ]),
  paper("general", "nda", "Confidentiality acknowledgment", "Record that someone agreed to keep information private", [
    f("Full name"), f("Company"), f("Date", "date"), f("I agree to keep this information confidential", "checkbox"),
  ]),

  paper("construction", "estimate", "Estimate", "A priced estimate to give a customer before they decide", [
    f("Customer"), f("Job name"), f("Date", "date"), f("Job site address"), f("Phone"), f("Email", "email", false),
    f("Scope of work", "longtext"), f("Materials included", "longtext", false), f("Exclusions", "longtext", false),
    f("Labor cost", "number", false), f("Materials cost", "number", false), f("Total estimate", "number"), f("This estimate is valid for (days)", "number", false),
  ]),
  paper("construction", "proposal-contract", "Proposal and contract", "Specifications, price and terms for a job, ready to sign", [
    f("Recipient of proposal"), f("Job name"), f("Date", "date"), f("Address, city, state and zip"), f("Phone"), f("Architect", "text", false),
    f("Date of plans", "date", false), f("Estimated start date", "date"), f("Estimated completion date", "date"),
    f("We hereby provide specifications and estimates for", "longtext"),
    f("Sum of", "number"), f("Payment terms", "text", false), f("This proposal is valid for (days)", "number", false),
  ], { approver: "Owner" }),
  paper("construction", "work-order", "Work order", "Authorize a piece of work before the crew starts", [
    f("Customer"), f("Job site address"), f("Date", "date"), f("Phone"), f("Scheduled date", "date", false), f("Assigned to", "text", false),
    f("Work to be performed", "longtext"), f("Materials needed", "longtext", false), f("Estimated cost", "number", false), f("Customer authorizes this work", "checkbox"),
  ], { approver: "Project manager", repeats: true }),
  paper("construction", "change-order", "Change order", "Record a change to the agreed scope and price", [
    f("Project"), f("Owner or client"), f("Job site address"), f("Change order number", "text", false), f("Date", "date"),
    f("Description of change", "longtext"),
    f("Original contract sum", "number"), f("Previous change orders total", "number", false), f("Amount of this change", "number"), f("Days added or removed", "number", false), f("New completion date", "date", false),
  ], { approver: "Project manager", repeats: true }),
  paper("construction", "rfi", "Request for information", "Ask the architect or owner a question that holds up the work", [
    f("Project"), f("RFI number", "text", false), f("Date", "date"), f("To"), f("From"), f("Response needed by", "date", false),
    f("Question", "longtext"), f("Drawing or spec reference", "text", false), f("Response", "longtext", false),
  ], { repeats: true }),
  paper("construction", "material-order", "Material order", "Order materials for a job and say where and when to deliver", [
    f("Supplier"), f("Job name"), f("Order date", "date"), f("Delivery address"), f("Needed by", "date"), f("Contact on site", "text", false),
    f("Items and quantities", "longtext"), f("Estimated total", "number", false),
  ], { approver: "Project manager", repeats: true }),
  paper("construction", "daily-log", "Daily job log", "What happened on site today", [
    f("Project"), f("Job site address", "text", false), f("Date", "date"), f("Weather"), f("Crew on site", "number"), f("Hours worked", "number", false),
    f("Subcontractors on site", "text", false), f("Equipment on site", "text", false),
    f("Work completed", "longtext"), f("Materials delivered", "longtext", false), f("Delays or issues", "longtext", false),
    f("Inspections or visitors", "longtext", false), f("A safety incident happened today", "checkbox", false),
  ], { repeats: true }),
  paper("construction", "toolbox-talk", "Toolbox talk record", "Prove the crew was briefed on a safety topic", [
    f("Project"), f("Date", "date"), f("Topic"), f("Led by"), f("Attendees", "longtext"), f("Points covered", "longtext", false), f("Questions or concerns raised", "longtext", false),
  ], { repeats: true }),
  paper("construction", "jsa", "Job safety analysis", "Check the hazards before the work starts", [
    f("Project"), f("Task"), f("Date", "date"), f("Location on site"), f("Supervisor"), f("Crew members", "longtext"),
    f("Hazards", "longtext"), f("Controls in place", "longtext"), f("Protective equipment required", "longtext", false),
    f("Nearest hospital or emergency contact", "text", false), f("Crew briefed", "checkbox"),
  ], { repeats: true }),
  paper("construction", "timesheet-crew", "Crew timesheet", "Hours for one worker on one job, for payroll", [
    f("Employee name"), f("Week starting", "date"), f("Project or job"), f("Regular hours", "number"), f("Overtime hours", "number", false), f("Notes", "longtext", false),
  ], { repeats: true, approver: "Project manager" }),
  paper("construction", "lien-waiver", "Lien waiver", "Confirm payment received for work done", [
    f("Project"), f("Property address"), f("Owner"), f("Claimant"), f("Type", "select", true, ["Conditional progress", "Unconditional progress", "Conditional final", "Unconditional final"]),
    f("Through date", "date"), f("Amount received", "number"), f("Check number", "text", false),
  ]),
  paper("construction", "sub-agreement", "Subcontractor information", "Collect what you need before a sub starts", [
    f("Company name"), f("Contact"), f("Phone"), f("Email", "email", false), f("Trade"), f("License number"),
    f("Insurance carrier", "text", false), f("Insurance expires", "date"), f("Workers' comp expires", "date", false),
    f("Certificate of insurance on file", "checkbox", false), f("W-9 on file", "checkbox", false),
  ], { approver: "Project manager" }),
  paper("construction", "completion", "Certificate of completion", "Owner confirms the work is finished and accepted", [
    f("Project"), f("Owner"), f("Job site address"), f("Date of completion", "date"), f("Warranty start date", "date", false),
    f("Remaining punch-list items", "longtext", false),
  ], { approver: "Owner" }),
  paper("construction", "warranty", "Warranty certificate", "Tell the owner what is covered, and for how long", [
    f("Project"), f("Owner"), f("Job site address"), f("Completion date", "date"), f("Warranty period"),
    f("Work covered", "longtext"), f("Not covered", "longtext", false),
  ]),

  paper("food", "temp-log", "Temperature log", "Cooler, freezer and hot-holding checks", [
    f("Date", "date"), f("Checked by"), f("Walk-in cooler (F)", "number"), f("Freezer (F)", "number"), f("Hot holding (F)", "number", false), f("Corrective action", "longtext", false),
  ], { repeats: true }),
  paper("food", "opening-checklist", "Opening checklist", "Run through before the doors open", [
    f("Date", "date"), f("Manager on duty"), f("Handwash stations stocked", "checkbox", false), f("Sanitizer tested", "checkbox", false), f("Equipment on and working", "checkbox", false), f("Notes", "longtext", false),
  ], { repeats: true }),
  paper("food", "waste-log", "Food waste and spoilage log", "Track what was thrown out and why", [
    f("Date", "date"), f("Item"), f("Quantity"), f("Reason", "select", true, ["Expired", "Dropped", "Cooked wrong", "Temperature", "Other"]),
  ], { repeats: true }),

  paper("vehicle", "inspection", "Vehicle inspection checklist", "Pre-trip check before a vehicle goes out", [
    f("Vehicle / plate"), f("Driver"), f("Date", "date"), f("Odometer", "number"), f("Lights, tires and brakes OK", "checkbox", false), f("Defects found", "longtext", false),
  ], { repeats: true }),
  paper("vehicle", "accident", "Vehicle accident report", "Details to keep for insurance", [
    f("Vehicle / plate"), f("Driver"), f("Date", "date"), f("Location"), f("Other party's name and insurance", "longtext", false), f("What happened", "longtext"), f("Police report number", "text", false),
  ]),
  paper("vehicle", "maintenance", "Maintenance record", "Log service so nothing gets missed", [
    f("Vehicle / plate"), f("Date", "date"), f("Odometer", "number"), f("Work done", "longtext"), f("Cost", "number"), f("Next service due", "date", false),
  ], { repeats: true }),

  paper("professional", "client-intake", "Client intake", "First details from a new client", [
    f("Client name"), f("Email", "email"), f("Phone"), f("What you need help with", "longtext"), f("How did you hear about us", "text", false),
  ]),
  paper("professional", "engagement", "Engagement acknowledgment", "Client confirms scope and fees", [
    f("Client name"), f("Scope of work", "longtext"), f("Fee", "number"), f("Date", "date"), f("I agree to the scope and fee", "checkbox"),
  ], { approver: "Partner" }),
  paper("professional", "timesheet", "Weekly timesheet", "Hours worked per client", [
    f("Name"), f("Week starting", "date"), f("Client or project"), f("Hours", "number"), f("Notes", "longtext", false),
  ], { repeats: true, approver: "Manager" }),

  paper("realestate", "showing-feedback", "Showing feedback", "Capture what a buyer thought", [
    f("Property address"), f("Date", "date"), f("Buyer name"), f("Interest level", "select", true, ["High", "Medium", "Low"]), f("Comments", "longtext", false),
  ], { repeats: true }),
  paper("realestate", "maintenance-request", "Tenant maintenance request", "Repairs that tenants report", [
    f("Unit"), f("Tenant name"), f("Phone"), f("What needs fixing", "longtext"), f("Permission to enter", "checkbox", false),
  ], { repeats: true }),
  paper("realestate", "move-in", "Move-in condition checklist", "Document the unit's condition on day one", [
    f("Unit"), f("Tenant name"), f("Date", "date"), f("Condition notes", "longtext"), f("Keys handed over", "number"),
  ]),

  paper("health", "patient-intake", "Patient intake", "First visit details", [
    f("Patient name"), f("Date of birth", "date"), f("Phone"), f("Reason for visit", "longtext"), f("Allergies", "longtext", false),
  ]),
  paper("health", "hipaa-ack", "HIPAA acknowledgment", "Patient received the privacy notice", [
    f("Patient name"), f("Date", "date"), f("I received the notice of privacy practices", "checkbox"),
  ]),
  paper("health", "equipment-log", "Equipment cleaning log", "Sterilization and cleaning record", [
    f("Date", "date"), f("Equipment"), f("Cleaned by"), f("Method"), f("Notes", "longtext", false),
  ], { repeats: true }),

  paper("retail", "return", "Return or exchange", "Record why an item came back", [
    f("Customer name"), f("Item"), f("Date", "date"), f("Reason", "select", true, ["Defective", "Wrong item", "Changed mind", "Other"]), f("Refund amount", "number", false),
  ], { repeats: true }),
  paper("retail", "inventory-count", "Inventory count sheet", "Count what is on the shelf", [
    f("Date", "date"), f("Counted by"), f("Section"), f("Discrepancies", "longtext", false),
  ], { repeats: true }),
  paper("retail", "vendor-order", "Vendor order form", "What you are ordering and when you need it", [
    f("Vendor"), f("Items", "longtext"), f("Needed by", "date"), f("Total", "number", false),
  ], { approver: "Owner" }),

  paper("beauty", "client-consent", "Client consent and allergy form", "Before a first service", [
    f("Client name"), f("Date", "date"), f("Service"), f("Allergies or sensitivities", "longtext", false), f("I understand the service and agree to proceed", "checkbox"),
  ]),
  paper("beauty", "patch-test", "Patch test record", "Record each test and its result", [
    f("Client name"), f("Date", "date"), f("Product tested"), f("Result", "select", true, ["No reaction", "Mild reaction", "Reaction, do not use"]), f("Done by"),
  ], { repeats: true }),
  paper("beauty", "sanitation-log", "Station sanitation log", "End-of-day cleaning record", [
    f("Date", "date"), f("Station"), f("Tools disinfected", "checkbox"), f("Surfaces cleaned", "checkbox"), f("Done by"),
  ], { repeats: true }),

  paper("childcare", "enrollment", "Enrollment form", "A new child joining", [
    f("Child's name"), f("Date of birth", "date"), f("Parent or guardian"), f("Phone"), f("Allergies or medical needs", "longtext", false), f("Start date", "date"),
  ]),
  paper("childcare", "pickup-auth", "Pickup authorization", "Who may collect a child", [
    f("Child's name"), f("Authorized person"), f("Relationship"), f("Phone"), f("Photo ID checked", "checkbox", false),
  ]),
  paper("childcare", "injury-report", "Injury or incident report", "Write it down the same day", [
    f("Child's name"), f("Date", "date"), f("What happened", "longtext"), f("First aid given", "longtext", false), f("Parent told", "checkbox"),
  ]),
  paper("childcare", "attendance", "Daily attendance sheet", "Who was here today", [
    f("Date", "date"), f("Room"), f("Children present", "number"), f("Staff on duty", "number"), f("Notes", "longtext", false),
  ], { repeats: true }),

  paper("manufacturing", "ncr", "Nonconformance report", "A part or batch that missed spec", [
    f("Part or batch"), f("Date found", "date"), f("What is wrong", "longtext"), f("Quantity affected", "number"), f("Action", "select", true, ["Rework", "Scrap", "Use as is", "Return to supplier"]),
  ], { repeats: true, approver: "Quality lead" }),
  paper("manufacturing", "equipment-maint", "Equipment maintenance log", "Service done on a machine", [
    f("Machine"), f("Date", "date"), f("Work done", "longtext"), f("Hours since last service", "number", false), f("Done by"),
  ], { repeats: true }),
  paper("manufacturing", "safety-walk", "Safety walk-through", "Weekly floor check", [
    f("Area"), f("Date", "date"), f("Guards and signage in place", "checkbox", false), f("Aisles clear", "checkbox", false), f("Issues found", "longtext", false),
  ], { repeats: true }),

  paper("legal", "matter-intake", "New matter intake", "Open a file for a client", [
    f("Client name"), f("Email", "email"), f("Phone"), f("Matter type"), f("Opposing party", "text", false), f("Summary", "longtext"),
  ]),
  paper("legal", "conflict-check", "Conflict check", "Before taking a matter", [
    f("Client name"), f("Opposing party"), f("Related parties", "longtext", false), f("Checked by"), f("Conflict found", "checkbox", false),
  ], { approver: "Managing partner" }),
  paper("legal", "trust-deposit", "Trust deposit request", "Money held for a client", [
    f("Client name"), f("Matter"), f("Amount", "number"), f("Received from"), f("Date", "date"),
  ], { approver: "Managing partner" }),

  paper("accounting", "tax-engagement", "Tax engagement acknowledgment", "Client agrees to scope and fee", [
    f("Client name"), f("Tax year"), f("Services included", "longtext"), f("Fee", "number"), f("I agree to the engagement terms", "checkbox"),
  ]),
  paper("accounting", "doc-checklist", "Client document checklist", "What the client still owes you", [
    f("Client name"), f("Tax year"), f("W-2s and 1099s received", "checkbox", false), f("Expense records received", "checkbox", false), f("Still missing", "longtext", false),
  ], { repeats: true }),
  paper("accounting", "extension", "Extension request", "Ask to file late", [
    f("Client name"), f("Tax year"), f("Reason", "longtext"), f("New due date", "date"),
  ], { approver: "Partner" }),
];

export const paperworkFor = (industry: IndustryId): Paperwork[] => PAPERWORK.filter((p) => p.industry === industry);

/** The ones filled in over and over for this kind of business: worth keeping handy. */
export const repeatingFor = (industry: IndustryId): Paperwork[] => paperworkFor(industry).filter((p) => p.repeats);
