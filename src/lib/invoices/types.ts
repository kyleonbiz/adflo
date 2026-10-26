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

/** One billed line. `rateCents` is the price of one unit. */
export interface InvoiceItem {
  description: string;
  qty: number;
  rateCents: number;
}

/** The business issuing the invoice ("From"). */
export interface Sender {
  name: string;
  address: string;
  phone: string;
  email: string;
}

/** Amounts are integer cents. Dates are `YYYY-MM-DD`. */
export interface Invoice {
  id: string;
  number: string;
  client: string;
  /** Where "Send" addresses the email. Empty until set. */
  clientEmail: string;
  /** One-line summary of the items, for lists and search. Derived from `items`. */
  description: string;
  items: InvoiceItem[];
  /** Sales tax as a percentage of the subtotal, e.g. 0.925. */
  taxRate: number;
  sender: Sender;
  /** Ways the client can pay, one per entry. */
  paymentMethods: string[];
  /** Total due: items plus tax. */
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
