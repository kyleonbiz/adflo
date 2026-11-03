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

export const NOTIFICATION_KEYS = ["renewals", "overdueInvoices", "formResponses", "weeklyDigest"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export const NOTIFICATION_INFO: Record<NotificationKey, { label: string; detail: string }> = {
  renewals: { label: "License and insurance renewals", detail: "A heads-up before a license, bond or certificate expires." },
  overdueInvoices: { label: "Overdue invoices", detail: "When a customer invoice passes its due date." },
  formResponses: { label: "New form responses", detail: "When someone sends back a form you shared." },
  weeklyDigest: { label: "Weekly summary", detail: "One Monday email with what is due and what changed." },
};

export interface NotificationPrefs {
  enabled: Record<NotificationKey, boolean>;
  /** How many days before a due date reminders start. */
  leadDays: 7 | 14 | 30 | 60;
}
export const LEAD_DAYS = [7, 14, 30, 60] as const;

export interface AppSettings {
  version: 1;
  details: BusinessDetails;
  notifications: NotificationPrefs;
}

export const defaultSettings = (): AppSettings => ({
  version: 1,
  details: { email: "", phone: "", address: "", timezone: "America/New_York" },
  notifications: { enabled: { renewals: true, overdueInvoices: true, formResponses: true, weeklyDigest: false }, leadDays: 30 },
});
