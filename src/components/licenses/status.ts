import type { AlertSeverity, LicenseStatus, RenewalStage } from "@/lib/licenses/types";

export const STATUS_LABEL: Record<LicenseStatus, string> = {
  active: "Active",
  renewal_window: "Renewal window",
  expiring: "Expiring soon",
  expired: "Expired",
};

export const STATUS_BADGE: Record<LicenseStatus, "success" | "default" | "warning" | "danger"> = {
  active: "success",
  renewal_window: "default",
  expiring: "warning",
  expired: "danger",
};

export const SEVERITY_BADGE: Record<AlertSeverity, "danger" | "warning" | "default"> = {
  critical: "danger",
  warning: "warning",
  info: "default",
};

export const STAGE_LABEL: Record<RenewalStage, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
};
