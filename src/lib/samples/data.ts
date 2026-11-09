import { addDays, addMonths } from "@/lib/dates";
import type { Contact } from "@/lib/contacts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { License, LicenseCategory } from "@/lib/licenses/types";
import type { Project, Task } from "@/lib/projects/types";
import type { Vendor, VendorCategory, VendorDocument } from "@/lib/vendors/types";

/** One complete set of demo records, with every date worked out from `today` so each state is represented. */
export interface SampleRecords {
  invoices: Invoice[];
  licenses: License[];
  vendors: Vendor[];
  contacts: Contact[];
  projects: Project[];
}

export type SampleSetId = "small" | "large";

export interface SampleSet {
  id: SampleSetId;
  label: string;
  blurb: string;
  build: (today: string) => SampleRecords;
}

const pick = <T,>(list: readonly T[], i: number): T => list[i % list.length]!;

/* ---------- builders shared by both sets ---------- */

function invoice(o: { n: number; id: string; client: string; description: string; cents: number; issuedAgo: number; termDays: number; status: Invoice["status"]; today: string; from: string; recurrence?: Invoice["recurrence"] }): Invoice {
  const issuedOn = addDays(o.today, -o.issuedAgo);
  return {
    id: o.id, number: `INV-${String(o.n).padStart(4, "0")}`, client: o.client, clientEmail: "", description: o.description,
    items: [{ description: o.description, qty: 1, rateCents: o.cents }], taxRate: 0,
    sender: { name: o.from, address: "", phone: "", email: "" }, paymentMethods: ["Bank transfer", "Check"],
    amountCents: o.cents, issuedOn, dueOn: addDays(issuedOn, o.termDays), status: o.status,
    paidOn: o.status === "paid" ? addDays(issuedOn, o.termDays - 3) : null,
    recurrence: o.recurrence ?? "none", reminderDays: [7, 1], notes: "",
  };
}

function license(o: { id: string; name: string; category: LicenseCategory; issuer: string; number: string; holder: string; expiresIn: number; termMonths: number; stage?: License["stage"]; missing?: boolean; today: string; cost?: number }): License {
  const expiresOn = addDays(o.today, o.expiresIn);
  return {
    id: o.id, name: o.name, category: o.category, issuer: o.issuer, number: o.number, holder: o.holder,
    issuedOn: addMonths(expiresOn, -o.termMonths), expiresOn, renewalTermMonths: o.termMonths,
    reminderDays: [90, 60, 30, 7], stage: o.stage ?? "not_started",
    requiredDocuments: [
      { id: `${o.id}-d0`, label: "Renewal application", received: !o.missing },
      { id: `${o.id}-d1`, label: "Renewal fee receipt", received: !o.missing && o.expiresIn > 30 },
    ],
    notes: "", verifiedOn: addDays(o.today, -20), renewalCost: o.cost ?? null,
  };
}

function vendor(o: { id: string; name: string; category: VendorCategory; contact: string; domain: string; status: Vendor["status"]; today: string; missing?: boolean; coiExpiresIn?: number; spend?: number; critical?: boolean; ago?: number }): Vendor {
  let seq = 0;
  const doc = (type: string, received: boolean, expiresIn: number | null = null): VendorDocument => ({
    id: `${o.id}-d${seq++}`, type, required: true,
    receivedOn: received ? addDays(o.today, -(o.ago ?? 120)) : null, expiresOn: received && expiresIn !== null ? addDays(o.today, expiresIn) : null,
  });
  return {
    id: o.id, name: o.name, category: o.category, contactName: o.contact, email: `ap@${o.domain}`, phone: "", taxId: "", notes: "",
    status: o.status, createdOn: addDays(o.today, -(o.ago ?? 120)),
    documents: [doc("W-9", !o.missing), doc("Certificate of insurance", !o.missing, o.coiExpiresIn ?? 200), doc("Master services agreement", !o.missing)],
    riskTier: o.critical ? "critical" : "standard", paymentTerms: "Net 30", annualSpend: o.spend ?? null, contractEndsOn: addDays(o.today, 200),
  };
}

function contact(id: string, name: string, company: string, category: Contact["category"], today: string, ago: number, contactedAgo: number | null): Contact {
  const slug = company.toLowerCase().replace(/[^a-z]+/g, "") || "example";
  return {
    id, name, company, category, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${slug}.example`, phone: "", notes: "",
    lastContacted: contactedAgo === null ? "" : addDays(today, -contactedAgo), createdOn: addDays(today, -ago),
  };
}

function task(id: string, title: string, assignee: string, dueOn: string | null, done = false, doneOn: string | null = null): Task {
  return { id, title, assignee, dueOn, repeat: "none", done, doneOn, followUpId: null };
}

/* ---------- small shop: a handful of records, one clear story ---------- */

export function smallSample(today: string): SampleRecords {
  const from = "Riverside Print & Sign";
  const inv = (n: number, client: string, description: string, cents: number, issuedAgo: number, status: Invoice["status"], termDays = 30) =>
    invoice({ n, id: `demo-inv-${n}`, client, description, cents, issuedAgo, termDays, status, today, from });
  return {
    invoices: [
      inv(101, "Maple Street Bakery", "Window graphics", 84_000, 45, "sent"),
      inv(102, "Cole & Daughters Plumbing", "Van lettering", 220_000, 34, "sent"),
      inv(103, "Harbor Dental", "Reception signage", 410_000, 20, "sent"),
      inv(104, "Maple Street Bakery", "Menu boards", 56_000, 60, "paid"),
      inv(105, "Greenway Landscaping", "Yard signs, 50 pack", 38_000, 1, "draft"),
    ],
    licenses: [
      license({ id: "demo-lic-1", name: "City business license", category: "business", issuer: "City Clerk", number: "BL-20418", holder: from, expiresIn: 21, termMonths: 12, stage: "in_progress", today }),
      license({ id: "demo-lic-2", name: "Sign installation permit", category: "permit", issuer: "County Building Dept", number: "SP-7731", holder: from, expiresIn: -6, termMonths: 24, missing: true, today }),
      license({ id: "demo-lic-3", name: "General liability insurance", category: "insurance", issuer: "Hartwell Insurance", number: "GL-55021", holder: from, expiresIn: 160, termMonths: 12, today }),
    ],
    vendors: [
      vendor({ id: "demo-v-1", name: "Brightline Vinyl Supply", category: "Supplies", contact: "Tom Brandt", domain: "brightline.example", status: "active", today, spend: 18_000 }),
      vendor({ id: "demo-v-2", name: "Quick Lift Rentals", category: "Equipment rental & leasing", contact: "Ana Ruiz", domain: "quicklift.example", status: "onboarding", today, missing: true, ago: 6 }),
      vendor({ id: "demo-v-3", name: "Keystone Accounting", category: "Accounting & tax", contact: "Mei Chen", domain: "keystone.example", status: "active", today, coiExpiresIn: -12 }),
    ],
    contacts: [
      contact("demo-c-1", "Linda Park", "Maple Street Bakery", "Customer", today, 200, 14),
      contact("demo-c-2", "Greg Cole", "Cole & Daughters Plumbing", "Customer", today, 150, 30),
      contact("demo-c-3", "Dr. Amir Haddad", "Harbor Dental", "Customer", today, 90, 8),
      contact("demo-c-4", "Rosa Delgado", "Greenway Landscaping", "Lead", today, 5, null),
      contact("demo-c-5", "Tom Brandt", "Brightline Vinyl Supply", "Vendor", today, 300, 40),
    ],
    projects: [{
      id: "demo-p-1", name: "Harbor Dental storefront", client: "Harbor Dental", description: "Design, approvals and install for the new storefront sign.",
      status: "active", startOn: addDays(today, -15), dueOn: addDays(today, 20), owner: "You",
      tasks: [
        task("demo-t-1", "Site measurements", "You", addDays(today, -10), true, addDays(today, -11)),
        task("demo-t-2", "Send proof for approval", "You", addDays(today, -1)),
        task("demo-t-3", "Order materials", "You", addDays(today, 4)),
        task("demo-t-4", "Schedule install crew", "You", addDays(today, 12)),
      ],
    }],
  };
}

/* ---------- large regulated company: many people, many records, plenty overdue ---------- */

const CLIENTS = ["Northwind Health System", "Contoso Energy", "Fabrikam Logistics", "Tailspin Aerospace", "Adventure Works Retail", "Wingtip Financial", "Litware Pharma", "Proseware Telecom", "Lucerne Foods", "Margie's Travel Group", "Alpine Ski House", "Woodgrove Bank"];
const SERVICES = ["Quarterly compliance audit", "Facilities maintenance, Q", "Managed IT services", "Regulatory filing support", "Training program delivery", "Equipment calibration", "Security assessment", "Staffing, contract labor"];
const VENDOR_NAMES: [string, VendorCategory][] = [
  ["Atlas Facilities Group", "Facilities & maintenance"], ["Beacon Security Services", "Security services"], ["Cobalt IT Solutions", "IT services & support"],
  ["Delta Freight Lines", "Freight & shipping"], ["Evergreen Waste Systems", "Waste & recycling"], ["Frontier Staffing", "Human resources & staffing"],
  ["Granite Legal LLP", "Legal services"], ["Helix Lab Supply", "Research & laboratory"], ["Ironwood Engineering", "Engineering"],
  ["Juniper Benefits Admin", "Payroll & benefits"], ["Keystone Insurance Brokers", "Insurance"], ["Lakeshore Catering", "Catering & food service"],
  ["Meridian Telecom", "Telecommunications"], ["Northstar Fleet Services", "Vehicles & fleet"], ["Orchid Environmental", "Environmental services"],
  ["Pinnacle Packaging", "Packaging"], ["Quartz Software Licensing", "Software"], ["Ridgeline Construction", "Construction & trades"],
  ["Summit Training Partners", "Education & training"], ["Tidewater Equipment Rental", "Equipment rental & leasing"], ["Union Print & Promo", "Printing & promotional products"],
  ["Vantage Consulting", "Consulting"], ["Westbrook Uniforms", "Uniforms & apparel"], ["Xenon Medical Supply", "Healthcare & medical"],
  ["Yellowstone Raw Materials", "Manufacturing & raw materials"], ["Zephyr Energy Services", "Energy & utilities"], ["Apex Accounting & Tax", "Accounting & tax"],
  ["Bluebird Translation", "Translation & language services"], ["Crestview Cleaning", "Cleaning & janitorial"], ["Driftwood Marketing", "Advertising & marketing"],
  ["Elmwood Real Estate", "Real estate & leasing"], ["Foxglove Design Studio", "Architecture & design"], ["Glacier Hardware", "IT hardware & equipment"],
  ["Harvest Supply Co.", "Agriculture & food supply"], ["Inlet Logistics", "Logistics"], ["Jasper Office Furniture", "Furniture & fixtures"],
];
const PEOPLE = ["Alex Morgan", "Priya Nair", "Sam Okafor", "Jordan Blake", "Casey Lin", "Taylor Reyes", "Morgan Ellis", "Riley Chen", "Devon Hart", "Jamie Ortiz", "Quinn Foster", "Avery Stone"];
const LICENSE_KINDS: [string, LicenseCategory, string][] = [
  ["State operating license", "business", "Department of Commerce"], ["Hazardous materials permit", "permit", "EPA Region 4"], ["Fire safety certificate", "certification", "Fire Marshal"],
  ["Professional engineer license", "professional", "State Board of Engineers"], ["OSHA training certification", "certification", "OSHA"], ["Pharmacy wholesale license", "professional", "Board of Pharmacy"],
  ["Commercial auto policy", "insurance", "Keystone Insurance"], ["Workers' compensation policy", "insurance", "Keystone Insurance"], ["Cyber liability policy", "policy", "Cobalt Underwriters"],
  ["Air quality permit", "permit", "State Environmental Agency"], ["Wastewater discharge permit", "permit", "Water Quality Board"], ["Food handler registration", "registration", "County Health"],
  ["Elevator inspection certificate", "certification", "State Labor Dept"], ["Data protection registration", "registration", "Privacy Authority"],
];
const SITES = ["Nashville HQ", "Memphis plant", "Atlanta distribution", "Dallas office", "Phoenix lab", "Denver depot"];

export function largeSample(today: string): SampleRecords {
  const from = "Meridian Industrial Group";
  const invoices = Array.from({ length: 48 }, (_, i): Invoice => {
    const status: Invoice["status"] = i % 11 === 10 ? "draft" : i % 7 === 6 ? "void" : i < 18 ? "paid" : "sent";
    return invoice({
      n: 2000 + i, id: `demo-inv-${i}`, client: pick(CLIENTS, i * 5 + 1), description: `${pick(SERVICES, i)}${i % 8 === 0 ? ` ${(i % 4) + 1}` : ""}`,
      cents: (40 + ((i * 37) % 460)) * 100_00 / 10, issuedAgo: 5 + i * 3, termDays: i % 3 === 0 ? 45 : 30, status, today, from,
      recurrence: i % 9 === 0 ? "quarterly" : "none",
    });
  });
  const licenses = Array.from({ length: 28 }, (_, i): License => {
    const [name, category, issuer] = pick(LICENSE_KINDS, i);
    const site = pick(SITES, i);
    const expiresIn = [-14, 9, 25, 48, 75, 110, 160, 240, 330, -3, 18, 62][i % 12]! + Math.floor(i / 12) * 40;
    return license({
      id: `demo-lic-${i}`, name: `${name}, ${site}`, category, issuer, number: `${issuer.slice(0, 2).toUpperCase()}-${40_000 + i * 137}`, holder: from,
      expiresIn, termMonths: category === "insurance" ? 12 : 24, today, stage: expiresIn < 60 && expiresIn > 0 && i % 2 ? "in_progress" : "not_started",
      missing: expiresIn < 30 && i % 3 === 0, cost: category === "insurance" ? 18_000 : 450 + (i % 5) * 300,
    });
  });
  const vendors = VENDOR_NAMES.map(([name, category], i): Vendor => vendor({
    id: `demo-v-${i}`, name, category, contact: pick(PEOPLE, i + 3), domain: `${name.split(" ")[0]!.toLowerCase()}.example`,
    status: i % 12 === 11 ? "inactive" : i % 6 === 5 ? "onboarding" : "active", today, missing: i % 6 === 5,
    coiExpiresIn: [200, 14, -9, 90, 365, 40][i % 6], spend: 12_000 + ((i * 7919) % 400) * 1_000, critical: i % 5 === 0, ago: 30 + i * 9,
  }));
  const companies = [...CLIENTS, ...VENDOR_NAMES.slice(0, 12).map(([n]) => n)];
  const contacts = Array.from({ length: 80 }, (_, i): Contact => {
    const first = ["Alex", "Priya", "Sam", "Jordan", "Casey", "Taylor", "Morgan", "Riley", "Devon", "Jamie"][i % 10]!;
    const last = ["Nguyen", "Patel", "Okafor", "Silva", "Kim", "Reyes", "Hughes", "Ortiz", "Novak", "Larsen", "Weber", "Haas"][Math.floor(i / 7) % 12]!;
    return contact(`demo-c-${i}`, `${first} ${last}`, pick(companies, i * 3), i < 24 ? "Vendor" : i % 9 === 0 ? "Lead" : i % 13 === 0 ? "Partner" : "Customer", today, 20 + i * 4, i % 6 === 5 ? null : (i * 5) % 120);
  });
  const projectNames = ["Annual compliance audit", "Plant expansion permits", "ERP migration", "Vendor consolidation", "Safety recertification", "New hire onboarding wave", "Data center move", "Insurance renewal", "Quality system upgrade", "Q4 financial close"];
  const projects = projectNames.map((name, i): Project => ({
    id: `demo-p-${i}`, name, client: pick(CLIENTS, i * 2), description: `${name} across ${pick(SITES, i)} and ${pick(SITES, i + 2)}.`,
    status: i === 9 ? "completed" : i % 5 === 4 ? "on_hold" : i % 4 === 0 ? "planning" : "active", startOn: addDays(today, -60 + i * 4), dueOn: addDays(today, -10 + i * 14),
    owner: pick(PEOPLE, i),
    tasks: Array.from({ length: 6 }, (_, t) => {
      const done = i === 9 || t < (i % 4);
      const dueOn = addDays(today, -12 + t * 6 + i * 2 - (i % 3) * 5);
      return task(`demo-t-${i}-${t}`, `${["Draft scope", "Collect documents", "Review with legal", "Submit to regulator", "Brief stakeholders", "Close out and file"][t]}`, pick(PEOPLE, i + t), dueOn, done, done ? addDays(dueOn, -1) : null);
    }),
  }));
  return { invoices, licenses, vendors, contacts, projects };
}

export const SAMPLE_SETS: SampleSet[] = [
  { id: "small", label: "Small shop", blurb: "A local sign shop: 5 invoices, 3 licenses, 3 vendors, 5 contacts and one active project. One overdue permit, one late invoice.", build: smallSample },
  { id: "large", label: "Large regulated company", blurb: "A multi-site industrial group: 48 invoices, 28 licenses, 36 vendors, 80 contacts and 10 projects with owners. Plenty overdue, expiring and missing documents.", build: largeSample },
];
