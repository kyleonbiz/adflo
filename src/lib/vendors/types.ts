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
}

export type DocState = "missing" | "valid" | "expiring" | "expired";
export type AlertSeverity = "info" | "warning" | "critical";
export interface VendorAlert {
  severity: AlertSeverity;
  message: string;
}
