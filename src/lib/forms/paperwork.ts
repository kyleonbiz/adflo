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
      id: `pw-${id}`, name, description: use, fields, requiresApproval: !!opts.approver, approver: opts.approver ?? "",
      documentTemplate: opts.doc ?? "",
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

  paper("construction", "change-order", "Change order", "Record a change to the agreed scope and price", [
    f("Project"), f("Client"), f("Description of change", "longtext"), f("Added cost", "number"), f("Added days", "number", false), f("Date", "date"),
  ], { approver: "Project manager" }),
  paper("construction", "daily-log", "Daily job log", "What happened on site today", [
    f("Project"), f("Date", "date"), f("Crew on site", "number"), f("Work completed", "longtext"), f("Weather"), f("Delays or issues", "longtext", false),
  ], { repeats: true }),
  paper("construction", "jsa", "Job safety analysis", "Check the hazards before the work starts", [
    f("Project"), f("Task"), f("Date", "date"), f("Hazards", "longtext"), f("Controls in place", "longtext"), f("Crew briefed", "checkbox"),
  ], { repeats: true }),
  paper("construction", "lien-waiver", "Lien waiver", "Confirm payment received for work done", [
    f("Project"), f("Claimant"), f("Amount received", "number"), f("Through date", "date"), f("Type", "select", true, ["Conditional", "Unconditional"]),
  ]),
  paper("construction", "sub-agreement", "Subcontractor information", "Collect what you need before a sub starts", [
    f("Company name"), f("Contact"), f("Trade"), f("License number"), f("Insurance expires", "date"), f("Certificate of insurance on file", "checkbox", false),
  ], { approver: "Project manager" }),

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
];

export const paperworkFor = (industry: IndustryId): Paperwork[] => PAPERWORK.filter((p) => p.industry === industry);

/** The ones filled in over and over for this kind of business: worth keeping handy. */
export const repeatingFor = (industry: IndustryId): Paperwork[] => paperworkFor(industry).filter((p) => p.repeats);
