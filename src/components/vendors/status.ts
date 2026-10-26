import type { AlertSeverity, DocState, VendorStatus } from "@/lib/vendors/types";

export const STATUS_LABEL: Record<VendorStatus, string> = {
  onboarding: "Onboarding", pending_approval: "Awaiting approval", approved: "Approved", rejected: "Rejected", inactive: "Inactive",
};
export const STATUS_BADGE: Record<VendorStatus, "default" | "warning" | "success" | "danger" | "muted"> = {
  onboarding: "default", pending_approval: "warning", approved: "success", rejected: "danger", inactive: "muted",
};
export const DOC_LABEL: Record<DocState, string> = { missing: "Missing", valid: "Valid", expiring: "Expiring", expired: "Expired" };
export const DOC_BADGE: Record<DocState, "muted" | "success" | "warning" | "danger"> = {
  missing: "muted", valid: "success", expiring: "warning", expired: "danger",
};
export const SEVERITY_BADGE: Record<AlertSeverity, "danger" | "warning" | "default"> = {
  critical: "danger", warning: "warning", info: "default",
};
