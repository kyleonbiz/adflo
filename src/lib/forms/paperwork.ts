import { layoutTemplate } from "./layout";
import type { FormField, FormTemplate } from "./types";

export const INDUSTRIES = [
  { id: "general", label: "Any business" },
  { id: "construction", label: "Construction and trades" },
  { id: "nonprofit", label: "Nonprofit" },
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

/**
 * The paperwork each kind of business keeps again and again. The rule for what belongs here: compliance and
 * safety records, signed acknowledgments and consents, inspection and condition records, and governance records.
 * Nothing financial, no payroll or HR forms, no bookkeeping, and nothing that a specialist app (job costing, shop or
 * practice management, enrollment, patient charts) already does as its main job.
 */
export const PAPERWORK: readonly Paperwork[] = [
  // Any business
  paper("general", "incident", "Incident report", "Write down what happened, while it is fresh", [
    f("Reported by"), f("Date of incident", "date"), f("Where it happened"), f("What happened", "longtext"), f("Anyone hurt", "checkbox", false), f("Action taken", "longtext", false),
  ]),
  paper("general", "nda", "Confidentiality acknowledgment", "Record that someone agreed to keep information private", [
    f("Full name"), f("Company"), f("Date", "date"), f("I agree to keep this information confidential", "checkbox"),
  ]),
  paper("general", "meeting-minutes", "Meeting minutes", "A record of what was decided and who does what next", [
    f("Meeting title"), f("Date", "date"), f("Location or call link", "text", false), f("Chaired by"), f("Attendees", "longtext"),
    f("Discussion", "longtext"), f("Decisions made", "longtext"), f("Action items and owners", "longtext", false), f("Next meeting date", "date", false),
  ], { repeats: true }),

  // Construction and trades (also used by home services)
  paper("construction", "proposal-contract", "Proposal and contract", "Specifications, price and terms for a job, ready to sign", [
    f("Recipient of proposal"), f("Job name"), f("Date", "date"), f("Address, city, state and zip"), f("Phone"), f("Architect", "text", false),
    f("Date of plans", "date", false), f("Estimated start date", "date"), f("Estimated completion date", "date"),
    f("We hereby provide specifications and estimates for", "longtext"),
    f("Sum of", "number"), f("Payment terms", "text", false), f("This proposal is valid for (days)", "number", false),
  ], { approver: "Owner" }),
  paper("construction", "jsa", "Job safety analysis", "Check the hazards before the work starts", [
    f("Project"), f("Task"), f("Date", "date"), f("Location on site"), f("Supervisor"), f("Crew members", "longtext"),
    f("Hazards", "longtext"), f("Controls in place", "longtext"), f("Protective equipment required", "longtext", false),
    f("Nearest hospital or emergency contact", "text", false), f("Crew briefed", "checkbox"),
  ], { repeats: true }),
  paper("construction", "toolbox-talk", "Toolbox talk record", "Prove the crew was briefed on a safety topic", [
    f("Project"), f("Date", "date"), f("Topic"), f("Led by"), f("Attendees", "longtext"), f("Points covered", "longtext", false), f("Questions or concerns raised", "longtext", false),
  ], { repeats: true }),
  paper("construction", "site-inspection", "Jobsite safety inspection", "The regular walk-through that catches hazards early", [
    f("Project"), f("Job site address", "text", false), f("Date", "date"), f("Inspected by"),
    f("Walkways and work areas clear", "checkbox", false), f("Fall protection in place", "checkbox", false), f("Ladders and scaffolds inspected", "checkbox", false),
    f("Electrical cords and tools in good condition", "checkbox", false), f("Fire extinguisher accessible", "checkbox", false), f("Everyone wearing required protective equipment", "checkbox", false),
    f("First aid kit stocked", "checkbox", false), f("Safety data sheets on site", "checkbox", false),
    f("Hazards found", "longtext", false), f("Corrective action and due date", "longtext", false),
  ], { repeats: true }),
  paper("construction", "sub-compliance", "Subcontractor compliance record", "What a sub must show before starting on a job", [
    f("Company name"), f("Contact"), f("Phone"), f("Email", "email", false), f("Trade"), f("License number"), f("License expires", "date", false),
    f("Insurance carrier", "text", false), f("Liability policy expires", "date"), f("Workers' comp policy expires", "date", false),
    f("Certificate of insurance on file", "checkbox", false), f("Additional insured endorsement confirmed", "checkbox", false), f("Safety program received", "checkbox", false),
  ], { approver: "Project manager" }),
  paper("construction", "completion", "Certificate of completion", "Owner confirms the work is finished and accepted", [
    f("Project"), f("Owner"), f("Job site address"), f("Date of completion", "date"), f("Warranty start date", "date", false),
    f("Remaining punch-list items", "longtext", false),
  ], { approver: "Owner" }),
  paper("construction", "warranty", "Warranty certificate", "Tell the owner what is covered, and for how long", [
    f("Project"), f("Owner"), f("Job site address"), f("Completion date", "date"), f("Warranty period"),
    f("Work covered", "longtext"), f("Not covered", "longtext", false),
  ]),

  // Restaurants and food service
  paper("food", "temp-log", "Temperature log", "Cooler, freezer and hot-holding checks", [
    f("Date", "date"), f("Checked by"), f("Walk-in cooler (F)", "number"), f("Freezer (F)", "number"), f("Hot holding (F)", "number", false), f("Corrective action", "longtext", false),
  ], { repeats: true }),
  paper("food", "thermometer-calibration", "Thermometer calibration log", "Show your thermometers read true", [
    f("Date", "date"), f("Thermometer (ID or location)"), f("Method", "select", true, ["Ice point", "Boiling point", "Manufacturer's method"]), f("Reading (F)", "number"),
    f("Within tolerance", "checkbox", false), f("Adjusted or replaced", "checkbox", false), f("Checked by"),
  ], { repeats: true }),
  paper("food", "cleaning-log", "Cleaning and sanitizing log", "Who cleaned what, how, and when", [
    f("Date", "date"), f("Area or equipment"), f("Frequency", "select", true, ["Each use", "Daily", "Weekly", "Monthly"]), f("Cleaning method and sanitizer used"),
    f("Sanitizer strength tested", "checkbox", false), f("Cleaned by"), f("Notes", "longtext", false),
  ], { repeats: true }),
  paper("food", "food-safety-inspection", "Food safety self-inspection", "A monthly walk-through before the health inspector does one", [
    f("Date", "date"), f("Inspected by"),
    f("Handwash sinks stocked and accessible", "checkbox", false), f("Food stored off the floor and covered", "checkbox", false), f("Raw and ready-to-eat foods kept apart", "checkbox", false),
    f("Prepared foods labeled and dated", "checkbox", false), f("Temperature and cleaning logs up to date", "checkbox", false), f("Chemicals stored away from food", "checkbox", false),
    f("Allergen information available", "checkbox", false), f("No sign of pests", "checkbox", false),
    f("Problems found", "longtext", false), f("Corrections and who will make them", "longtext", false),
  ], { repeats: true }),
  paper("food", "pest-control-log", "Pest control log", "Each visit and what was found", [
    f("Date", "date"), f("Service company"), f("Technician", "text", false), f("Type of visit", "select", true, ["Routine", "Callback", "Inspection only"]),
    f("Activity or findings", "longtext"), f("Action taken", "longtext", false), f("Next visit date", "date", false),
  ], { repeats: true }),

  // Auto, fleet and trucking
  paper("vehicle", "inspection", "Vehicle inspection report", "The pre-trip or post-trip check, with any defects signed off", [
    f("Vehicle / plate"), f("Driver"), f("Date", "date"), f("Odometer", "number"), f("Inspection", "select", true, ["Pre-trip", "Post-trip"]),
    f("Brakes", "checkbox", false), f("Tires and wheels", "checkbox", false), f("Lights and signals", "checkbox", false), f("Mirrors and windshield", "checkbox", false),
    f("Fluid levels and no leaks", "checkbox", false), f("Emergency equipment present", "checkbox", false), f("Defects found", "longtext", false),
  ], { repeats: true }),
  paper("vehicle", "accident", "Vehicle accident report", "Details to keep for insurance", [
    f("Vehicle / plate"), f("Driver"), f("Date", "date"), f("Location"), f("Other party's name and insurance", "longtext", false), f("What happened", "longtext"), f("Police report number", "text", false),
  ]),
  paper("vehicle", "hazwaste-inspection", "Hazardous waste storage inspection", "The regular check of where used oil, solvents and batteries are kept", [
    f("Date", "date"), f("Inspected by"), f("Storage area"),
    f("Containers closed and labeled", "checkbox", false), f("Containers in good condition", "checkbox", false), f("No leaks or spills", "checkbox", false),
    f("Aisle space and emergency equipment clear", "checkbox", false), f("Start dates marked on containers", "checkbox", false),
    f("Problems found", "longtext", false), f("Corrective action", "longtext", false),
  ], { repeats: true }),

  // Professional services, tech and agencies
  paper("professional", "client-intake", "Client intake", "First details from a new client", [
    f("Client name"), f("Email", "email"), f("Phone"), f("What you need help with", "longtext"), f("How did you hear about us", "text", false),
  ]),
  paper("professional", "scope-confirmation", "Scope of work confirmation", "Client confirms what is and is not included", [
    f("Client name"), f("Project name"), f("Start date", "date"), f("Target completion date", "date", false), f("Client contact for approvals", "text", false),
    f("Scope of work", "longtext"), f("Deliverables", "longtext"), f("Not included", "longtext", false), f("I confirm the scope above", "checkbox"),
  ]),

  // Real estate and property management
  paper("realestate", "move-in", "Move-in and move-out inspection", "Document the unit's condition so both sides agree", [
    f("Property address"), f("Unit", "text", false), f("Tenant name"), f("Inspection", "select", true, ["Move-in", "Move-out"]), f("Date", "date"), f("Keys handed over", "number", false),
    f("Condition by room", "longtext"), f("Damage or issues noted", "longtext", false),
  ]),
  paper("realestate", "lead-paint", "Lead-based paint disclosure", "Required for homes built before 1978, kept on file", [
    f("Property address"), f("Unit", "text", false), f("Tenant name"), f("Date", "date"),
    f("Lead-based paint or hazards are known to be present", "checkbox", false), f("Available lead reports and records were provided", "checkbox", false),
    f("The tenant received the EPA lead hazard pamphlet", "checkbox"), f("What is known about lead-based paint here", "longtext", false),
  ]),
  paper("realestate", "notice-to-enter", "Notice to enter", "Give a tenant written notice before entering their unit", [
    f("Tenant name"), f("Unit or address"), f("Date of notice", "date"), f("Date and time of entry"),
    f("Reason", "select", true, ["Inspection", "Repair", "Showing", "Pest control", "Other"]), f("Details", "longtext", false),
    f("How the notice was given", "select", true, ["Hand delivered", "Posted on the door", "Mailed", "Emailed"]),
  ], { repeats: true }),

  // Healthcare practices
  paper("health", "hipaa-ack", "HIPAA acknowledgment", "Patient received the privacy notice", [
    f("Patient name"), f("Date", "date"), f("I received the notice of privacy practices", "checkbox"),
  ]),
  paper("health", "equipment-log", "Sterilization and equipment cleaning log", "Each cycle, and whether the monitoring passed", [
    f("Date", "date"), f("Equipment"), f("Method"), f("Monitoring result", "select", true, ["Passed", "Failed, retest done", "Not tested today"]), f("Cleaned by"), f("Notes", "longtext", false),
  ], { repeats: true }),
  paper("health", "sharps-log", "Sharps injury log", "Record needlestick and sharps injuries, with names kept private", [
    f("Date", "date"), f("Employee ID or initials"), f("Device type and brand"), f("Area where it happened"), f("How it happened", "longtext"), f("Follow-up completed", "checkbox", false),
  ], { repeats: true }),

  // Beauty and wellness
  paper("beauty", "client-consent", "Client consent and allergy form", "Before a first service", [
    f("Client name"), f("Date", "date"), f("Service"), f("Allergies or sensitivities", "longtext", false), f("I understand the service and agree to proceed", "checkbox"),
  ]),
  paper("beauty", "patch-test", "Patch test record", "Record each test and its result", [
    f("Client name"), f("Date", "date"), f("Product tested"), f("Result", "select", true, ["No reaction", "Mild reaction", "Reaction, do not use"]), f("Done by"),
  ], { repeats: true }),
  paper("beauty", "sanitation-log", "Station sanitation log", "End-of-day cleaning record", [
    f("Date", "date"), f("Station"), f("Tools disinfected", "checkbox"), f("Surfaces cleaned", "checkbox"), f("Done by"),
  ], { repeats: true }),
  paper("beauty", "pedicure-log", "Pedicure equipment cleaning log", "One entry each time a tub or basin is cleaned", [
    f("Date", "date"), f("Tub or basin"), f("Cleaned", "select", true, ["After a client", "End of day", "Weekly"]), f("Disinfectant used"), f("Cleaned by (initials)"), f("License number", "text", false),
  ], { repeats: true }),

  // Education and childcare
  paper("childcare", "pickup-auth", "Pickup authorization", "Who may collect a child", [
    f("Child's name"), f("Authorized person"), f("Relationship"), f("Phone"), f("Photo ID checked", "checkbox", false),
  ]),
  paper("childcare", "injury-report", "Injury or incident report", "Write it down the same day", [
    f("Child's name"), f("Date", "date"), f("What happened", "longtext"), f("First aid given", "longtext", false), f("Parent told", "checkbox"),
  ]),
  paper("childcare", "medication-auth", "Medication authorization", "A parent's permission to give a medication", [
    f("Child's name"), f("Medication name"), f("Dose"), f("When and how to give it", "longtext"), f("Start date", "date"), f("Stop date", "date", false),
    f("Allergies or reactions to know about", "text", false), f("I authorize staff to give this medication as directed", "checkbox"),
  ], { repeats: true }),
  paper("childcare", "medication-log", "Medication administration log", "Every dose given, and by whom", [
    f("Date", "date"), f("Child's name"), f("Medication"), f("Dose given"), f("Time given"), f("Given by"), f("Parent told", "checkbox", false),
  ], { repeats: true }),
  paper("childcare", "drill-log", "Emergency drill record", "Fire, severe weather and lockdown drills", [
    f("Date", "date"), f("Drill", "select", true, ["Fire", "Severe weather", "Lockdown", "Evacuation"]), f("Time"), f("Minutes to clear the building", "number", false),
    f("Everyone accounted for", "checkbox"), f("Conducted by"), f("Problems noticed", "longtext", false),
  ], { repeats: true }),
  paper("childcare", "field-trip", "Field trip permission", "A parent's permission for an outing", [
    f("Child's name"), f("Destination"), f("Trip date", "date"), f("Emergency contact phone"), f("Allergies or medical needs", "longtext", false),
    f("I give permission for my child to take part", "checkbox"), f("I authorize emergency medical care if I cannot be reached", "checkbox"),
  ], { repeats: true }),

  // Manufacturing
  paper("manufacturing", "ncr", "Nonconformance report", "A part or batch that missed spec", [
    f("Part or batch"), f("Date found", "date"), f("What is wrong", "longtext"), f("Quantity affected", "number"), f("Action", "select", true, ["Rework", "Scrap", "Use as is", "Return to supplier"]),
  ], { repeats: true, approver: "Quality lead" }),
  paper("manufacturing", "safety-walk", "Safety walk-through", "Weekly floor check", [
    f("Area"), f("Date", "date"), f("Guards and signage in place", "checkbox", false), f("Aisles clear", "checkbox", false), f("Issues found", "longtext", false),
  ], { repeats: true }),
  paper("manufacturing", "loto-inspection", "Lockout/tagout inspection", "The yearly check that an energy control procedure is followed", [
    f("Machine or equipment"), f("Procedure inspected"), f("Date", "date"), f("Inspector"), f("Employee observed"),
    f("Energy sources identified and isolated", "checkbox", false), f("Locks and tags applied correctly", "checkbox", false), f("Stored energy released", "checkbox", false),
    f("Zero energy verified before work", "checkbox", false), f("Procedure followed step by step", "checkbox", false),
    f("Deficiencies found", "longtext", false), f("Corrective action", "longtext", false),
  ], { repeats: true }),

  // Legal
  paper("legal", "matter-intake", "New matter intake", "Open a file for a client", [
    f("Client name"), f("Email", "email"), f("Phone"), f("Matter type"), f("Opposing party", "text", false), f("Summary", "longtext"),
  ]),
  paper("legal", "conflict-check", "Conflict check", "Before taking a matter", [
    f("Client name"), f("Opposing party"), f("Related parties", "longtext", false), f("Checked by"), f("Conflict found", "checkbox", false),
  ], { approver: "Managing partner" }),
  paper("legal", "file-closing", "File closing record", "Close a matter and record what happens to the file", [
    f("Client name"), f("Matter"), f("Closing date", "date"), f("Closing letter sent to the client", "checkbox", false), f("Original documents returned", "checkbox", false),
    f("What happens to the file", "select", true, ["Returned to client", "Stored", "Scheduled for destruction"]), f("Retention period"), f("Destruction date", "date", false), f("Notes", "longtext", false),
  ]),

  // Accounting and tax (the firm's own administration, not client financials)
  paper("accounting", "scope-of-services", "Scope of services confirmation", "Client confirms what the firm will and will not do", [
    f("Client name"), f("Period covered"), f("Services included", "longtext"), f("Services not included", "longtext", false), f("Information the client will provide", "longtext"),
    f("I understand what is and is not included", "checkbox"),
  ]),
  paper("accounting", "security-review", "Data security review", "The regular review of how client information is protected", [
    f("Review date", "date"), f("Reviewed by"), f("Period covered"),
    f("Written information security plan reviewed", "checkbox", false), f("Staff reminded of the data-handling rules", "checkbox", false), f("Software and devices updated", "checkbox", false),
    f("Access limited to those who need it", "checkbox", false), f("Service providers confirmed to protect data", "checkbox", false), f("Backups tested", "checkbox", false),
    f("Incidents or near misses", "longtext", false), f("Changes made to the plan", "longtext", false),
  ], { repeats: true }),
  paper("accounting", "records-destruction", "Client records destruction log", "Record what was destroyed, when and how", [
    f("Client name"), f("Records destroyed", "longtext"), f("Date range of the records"), f("Retention period"), f("Destruction date", "date"),
    f("Method", "select", true, ["Shredded", "Securely erased", "Returned to client"]),
  ], { repeats: true }),

  // Retail and e-commerce
  paper("retail", "refused-sale", "Refused sale log", "Record each age-restricted sale you turned down", [
    f("Date", "date"), f("Time"), f("Product type", "select", true, ["Tobacco or vape", "Alcohol", "Other age-restricted"]),
    f("Reason", "select", true, ["No ID shown", "Under the legal age", "ID looked altered", "Buying for a minor", "Other"]), f("Staff member"), f("Notes", "longtext", false),
  ], { repeats: true }),
  paper("retail", "recall-record", "Product recall record", "What you did when a product was recalled", [
    f("Product name and SKU"), f("Lot or batch", "text", false), f("Supplier"), f("Recall notice date", "date"),
    f("Action taken", "select", true, ["Pulled from shelves", "Returned to supplier", "Destroyed", "No stock on hand"]), f("Units pulled", "number", false),
    f("Customers notified", "checkbox", false), f("Notes", "longtext", false),
  ]),
  paper("retail", "store-safety", "Store safety inspection", "A regular walk-through of the floor and stockroom", [
    f("Date", "date"), f("Inspected by"),
    f("Exits clear and unlocked during open hours", "checkbox", false), f("Fire extinguisher accessible and tagged", "checkbox", false), f("Aisles and stockroom clear", "checkbox", false),
    f("Hazardous products stored correctly", "checkbox", false), f("Floors clean and dry", "checkbox", false), f("First aid kit stocked", "checkbox", false), f("Required licenses and notices posted", "checkbox", false),
    f("Issues found", "longtext", false), f("Corrections and who will make them", "longtext", false),
  ], { repeats: true }),

  // Nonprofits
  paper("nonprofit", "coi-disclosure", "Conflict of interest disclosure", "The yearly statement from every board member and officer", [
    f("Name"), f("Role", "select", true, ["Board member", "Officer", "Key employee", "Committee member"]), f("Date", "date"), f("Period covered"),
    f("I have no conflicts of interest to report", "checkbox", false), f("Organizations or interests that could conflict", "longtext", false), f("Related relationships to disclose", "longtext", false),
  ], { repeats: true }),
  paper("nonprofit", "board-minutes", "Board meeting minutes", "The official record of a board meeting", [
    f("Meeting name"), f("Date", "date"), f("Location or call link", "text", false), f("Directors present", "longtext"), f("Directors absent", "text", false),
    f("Quorum present", "checkbox"), f("Previous minutes approved", "checkbox", false), f("Discussion", "longtext"), f("Motions and votes", "longtext"), f("Action items", "longtext", false), f("Next meeting date", "date", false),
  ], { repeats: true }),
  paper("nonprofit", "volunteer-agreement", "Volunteer agreement and release", "Sign-up, waiver and photo permission in one", [
    f("Volunteer name"), f("Phone"), f("Email", "email", false), f("Emergency contact and phone"), f("Role or event"), f("Date", "date"),
    f("I understand the activity and take part at my own risk", "checkbox"), f("I agree to follow the organization's rules", "checkbox"), f("I allow photos and video to be used", "checkbox", false),
  ], { repeats: true }),
];

export const paperworkFor = (industry: IndustryId): Paperwork[] => PAPERWORK.filter((p) => p.industry === industry);

/** The ones filled in over and over for this kind of business: worth keeping handy. */
export const repeatingFor = (industry: IndustryId): Paperwork[] => paperworkFor(industry).filter((p) => p.repeats);
