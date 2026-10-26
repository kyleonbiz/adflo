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

/** One completed renewal, newest last. */
export interface RenewalRecord {
  /** The day the renewal was recorded. */
  on: string;
  previousExpiresOn: string;
  newExpiresOn: string;
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
  /** The day someone confirmed the details match the license itself. Absent means it still needs review. */
  verifiedOn?: string;
  renewals?: RenewalRecord[];
}

/** Documents a license of each category usually needs at renewal; they prefill the add form. */
export const DEFAULT_DOCUMENTS: Record<LicenseCategory, string[]> = {
  business: ["Annual report", "Renewal fee receipt"],
  professional: ["Continuing education proof", "Renewal fee receipt"],
  permit: ["Signed application", "Renewal fee receipt"],
  insurance: ["Updated certificate of insurance"],
  registration: ["Registration certificate"],
  other: [],
};

export type LicenseStatus = "active" | "renewal_window" | "expiring" | "expired";
export type AlertSeverity = "info" | "warning" | "critical";

export interface LicenseAlert {
  severity: AlertSeverity;
  message: string;
  /** Review reminders are about data quality, not the renewal itself. */
  kind?: "review";
}

export interface RenewalTask {
  licenseId: string;
  title: string;
  dueOn: string;
  daysLeft: number;
  severity: AlertSeverity;
  stage: RenewalStage;
}
