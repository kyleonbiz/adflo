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
  weeklyDigest: { label: "Weekly summary", detail: "One Monday email with what is late and what is due this week: invoices, renewals, tasks, equipment and reminders." },
};

export interface NotificationPrefs {
  enabled: Record<NotificationKey, boolean>;
  /** How many days before a due date reminders start. */
  leadDays: 7 | 14 | 30 | 60;
}
export const LEAD_DAYS = [7, 14, 30, 60] as const;

/** Things AdFlo does by itself on the business's behalf. All off until the owner switches them on. */
export interface AutomationPrefs {
  /** Email vendors who still owe a required document (a missing, expired or soon-expiring certificate of insurance, a W-9, a license). */
  vendorChase: boolean;
  /** Email customers about their invoices: before the due date, on it, and weekly once it is overdue (three times). */
  invoiceReminders: boolean;
  /** Create the next invoice of a recurring series on its issue date: "draft" for approval, or "send" straight to the customer. */
  recurringInvoices: "off" | "draft" | "send";
  /** Remind people who were emailed an onboarding packet and have not sent everything back: after 3 days, then weekly, up to three times. */
  packetReminders: boolean;
  /** Add a follow-up task (once each) to the Projects list when a renewal window opens, equipment comes due, an invoice is two weeks late, or a vendor or packet goes quiet. */
  autoTasks: boolean;
  /** Start the subcontractor onboarding packet for a newly added vendor that has an email: "draft" only adds it to Forms & Paperwork, "send" also emails it. */
  vendorPacket: "off" | "draft" | "send";
}

export interface AppSettings {
  version: 1;
  details: BusinessDetails;
  notifications: NotificationPrefs;
  automation: AutomationPrefs;
}

export const defaultSettings = (): AppSettings => ({
  version: 1,
  details: { email: "", phone: "", address: "", timezone: "America/New_York" },
  notifications: { enabled: { renewals: true, overdueInvoices: true, formResponses: true, weeklyDigest: false }, leadDays: 30 },
  automation: { vendorChase: false, invoiceReminders: false, recurringInvoices: "off", packetReminders: false, autoTasks: false, vendorPacket: "off" },
});
