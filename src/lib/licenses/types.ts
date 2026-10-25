export const LICENSE_CATEGORIES = [
  { value: "business", label: "Business license" },
  { value: "professional", label: "Professional license" },
  { value: "permit", label: "Permit" },
  { value: "insurance", label: "Insurance" },
  { value: "registration", label: "Registration" },
  { value: "other", label: "Other" },
] as const;
export type LicenseCategory = (typeof LICENSE_CATEGORIES)[number]["value"];

export const RENEWAL_STAGES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
] as const;
export type RenewalStage = (typeof RENEWAL_STAGES)[number]["value"];

export interface RequiredDocument {
  id: string;
  label: string;
  received: boolean;
}

/** All dates are calendar days as `YYYY-MM-DD`. */
export interface License {
  id: string;
  name: string;
  category: LicenseCategory;
  issuer: string;
  number: string;
  holder: string;
  issuedOn: string;
  expiresOn: string;
  renewalTermMonths: number;
  /** Days before expiry at which a reminder fires, e.g. [60, 30, 7]. */
  reminderDays: number[];
  stage: RenewalStage;
  requiredDocuments: RequiredDocument[];
  notes: string;
}

export type LicenseStatus = "active" | "renewal_window" | "expiring" | "expired";
export type AlertSeverity = "info" | "warning" | "critical";

export interface LicenseAlert {
  severity: AlertSeverity;
  message: string;
}

export interface RenewalTask {
  licenseId: string;
  title: string;
  dueOn: string;
  daysLeft: number;
  severity: AlertSeverity;
  stage: RenewalStage;
}
