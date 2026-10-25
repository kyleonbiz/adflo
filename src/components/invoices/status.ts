import type { AlertSeverity, InvoiceState } from "@/lib/invoices/types";

export const STATE_LABEL: Record<InvoiceState, string> = {
  draft: "Draft",
  upcoming: "Sent",
  due_soon: "Due soon",
  due_today: "Due today",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export const STATE_BADGE: Record<InvoiceState, "muted" | "default" | "warning" | "danger" | "success"> = {
  draft: "muted",
  upcoming: "default",
  due_soon: "warning",
  due_today: "warning",
  overdue: "danger",
  paid: "success",
  void: "muted",
};

export const SEVERITY_BADGE: Record<AlertSeverity, "danger" | "warning" | "default"> = {
  critical: "danger",
  warning: "warning",
  info: "default",
};
