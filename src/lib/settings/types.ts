export const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
] as const;

export interface BusinessDetails {
  email: string;
  phone: string;
  address: string;
  timezone: string;
}

export const NOTIFICATION_KEYS = ["renewals", "overdueInvoices", "approvals", "weeklyDigest"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export const NOTIFICATION_INFO: Record<NotificationKey, { label: string; detail: string }> = {
  renewals: { label: "License and insurance renewals", detail: "A heads-up before a license, bond or certificate expires." },
  overdueInvoices: { label: "Overdue invoices", detail: "When a customer invoice passes its due date." },
  approvals: { label: "Approval requests", detail: "When a form, vendor or request is waiting on you." },
  weeklyDigest: { label: "Weekly summary", detail: "One Monday email with what is due and what changed." },
};

export interface NotificationPrefs {
  enabled: Record<NotificationKey, boolean>;
  /** How many days before a due date reminders start. */
  leadDays: 7 | 14 | 30 | 60;
}
export const LEAD_DAYS = [7, 14, 30, 60] as const;

export const VARIANCE_OPTIONS = [10, 25, 50] as const;

/** Optional checks run when an invoice is saved. All are off until switched on. */
export interface InvoiceChecks {
  /** Warn when a client already has an invoice for the same total issued within a few days. */
  duplicates: boolean;
  /** Warn when the total is far from the client's recent average. */
  unusualAmount: boolean;
  /** How far from the average, in percent, counts as unusual. */
  variancePct: (typeof VARIANCE_OPTIONS)[number];
  /** Show "Add client to Contacts" in each invoice's menu. */
  addToContacts: boolean;
}

export interface AppSettings {
  version: 1;
  details: BusinessDetails;
  notifications: NotificationPrefs;
  invoiceChecks: InvoiceChecks;
}

export const defaultSettings = (): AppSettings => ({
  version: 1,
  details: { email: "", phone: "", address: "", timezone: "America/New_York" },
  notifications: { enabled: { renewals: true, overdueInvoices: true, approvals: true, weeklyDigest: false }, leadDays: 30 },
  invoiceChecks: { duplicates: false, unusualAmount: false, variancePct: 25, addToContacts: false },
});
