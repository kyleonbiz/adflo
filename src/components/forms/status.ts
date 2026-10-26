import type { SubmissionStatus } from "@/lib/forms/types";

export const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  received: "Received", pending: "Awaiting approval", approved: "Approved", rejected: "Rejected",
};
export const SUBMISSION_BADGE: Record<SubmissionStatus, "default" | "warning" | "success" | "danger"> = {
  received: "default", pending: "warning", approved: "success", rejected: "danger",
};
