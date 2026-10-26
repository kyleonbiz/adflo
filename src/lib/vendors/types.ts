export const VENDOR_CATEGORIES = ["Supplies", "Software", "Professional services", "Logistics", "Other"] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export type VendorStatus = "onboarding" | "pending_approval" | "approved" | "rejected" | "inactive";

/** Dates are `YYYY-MM-DD`. A document is "received" once `receivedOn` is set. */
export interface VendorDocument {
  id: string;
  type: string;
  required: boolean;
  receivedOn: string | null;
  expiresOn: string | null;
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
