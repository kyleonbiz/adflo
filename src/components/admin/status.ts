import type { Priority, RequestStatus } from "@/lib/admin/types";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending_approval: "Awaiting approval", open: "Open", in_progress: "In progress", done: "Done", declined: "Declined",
};
export const STATUS_BADGE: Record<RequestStatus, "warning" | "default" | "success" | "muted" | "danger"> = {
  pending_approval: "warning", open: "default", in_progress: "default", done: "success", declined: "danger",
};
export const PRIORITY_BADGE: Record<Priority, "danger" | "muted" | "outline"> = { high: "danger", normal: "outline", low: "muted" };
