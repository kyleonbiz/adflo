export const RECURRENCES = [
  { value: "none", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;
export type Recurrence = (typeof RECURRENCES)[number]["value"];

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

/** What the invoice means today: its stored status combined with how close or late the due date is. */
export type InvoiceState = "draft" | "upcoming" | "due_soon" | "due_today" | "overdue" | "paid" | "void";

/** Amounts are integer cents. Dates are `YYYY-MM-DD`. */
export interface Invoice {
  id: string;
  number: string;
  client: string;
  /** Where "Send" addresses the email. Empty until set. */
  clientEmail: string;
  description: string;
  amountCents: number;
  issuedOn: string;
  dueOn: string;
  status: InvoiceStatus;
  paidOn: string | null;
  recurrence: Recurrence;
  /** Days before the due date at which a payment reminder is sent, e.g. [7, 1]. */
  reminderDays: number[];
  notes: string;
}

export type AlertSeverity = "info" | "warning" | "critical";
export interface InvoiceAlert {
  severity: AlertSeverity;
  message: string;
}
