/** Alphabetical, with "Other" last. Wide enough that most companies never need "Other". */
export const VENDOR_CATEGORIES = [
  "Accounting & tax",
  "Advertising & marketing",
  "Agriculture & food supply",
  "Architecture & design",
  "Banking & financial services",
  "Catering & food service",
  "Cleaning & janitorial",
  "Construction & trades",
  "Consulting",
  "Creative & media",
  "Education & training",
  "Energy & utilities",
  "Engineering",
  "Environmental services",
  "Equipment rental & leasing",
  "Events & venues",
  "Facilities & maintenance",
  "Freight & shipping",
  "Furniture & fixtures",
  "Healthcare & medical",
  "Hospitality & travel",
  "Human resources & staffing",
  "Insurance",
  "IT hardware & equipment",
  "IT services & support",
  "Legal services",
  "Logistics",
  "Manufacturing & raw materials",
  "Packaging",
  "Payroll & benefits",
  "Printing & promotional products",
  "Professional services",
  "Real estate & leasing",
  "Research & laboratory",
  "Security services",
  "Software",
  "Supplies",
  "Telecommunications",
  "Translation & language services",
  "Uniforms & apparel",
  "Vehicles & fleet",
  "Waste & recycling",
  "Other",
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const RISK_TIERS = [
  { value: "standard", label: "Standard" },
  { value: "critical", label: "Critical to the business" },
] as const;
export type RiskTier = (typeof RISK_TIERS)[number]["value"];

export const PAYMENT_TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 45", "Net 60"] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export type VendorStatus = "onboarding" | "pending_approval" | "approved" | "rejected" | "inactive";

/** Dates are `YYYY-MM-DD`. A document is "received" once `receivedOn` is set. */
export interface VendorDocument {
  id: string;
  type: string;
  required: boolean;
  receivedOn: string | null;
  expiresOn: string | null;
  /** A scanned copy attached to the record. `url` is only valid in the browser that attached it. */
  file?: { name: string; size: number; url: string } | null;
}

/** One line in a vendor's running log: what was said or sent, and when. `reply` marks that they answered, which restarts the reminder count. */
export interface VendorNote {
  id: string;
  /** `YYYY-MM-DD`. */
  on: string;
  kind: "note" | "reminder" | "reply";
  text: string;
  by: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactName: string;
  email: string;
  phone: string;
  /** Digits only, nine of them (a US EIN), or empty. */
  taxId: string;
  notes: string;
  status: VendorStatus;
  createdOn: string;
  documents: VendorDocument[];
  decidedBy: string | null;
  decidedOn: string | null;
  comment: string;
  /** Dated notes and reminders, oldest first. Absent until the first entry. */
  activity?: VendorNote[];
  /** How much the business leans on this vendor. Absent means standard. */
  riskTier?: RiskTier;
  paymentTerms?: PaymentTerms;
  /** When the current contract ends, `YYYY-MM-DD`. */
  contractEndsOn?: string | null;
  /** About how many dollars a year you spend with them. */
  annualSpend?: number | null;
  /** Your own 1 to 5 rating. */
  rating?: number | null;
}

export type DocState = "missing" | "valid" | "expiring" | "expired";
export type AlertSeverity = "info" | "warning" | "critical";
export interface VendorAlert {
  severity: AlertSeverity;
  message: string;
}
