import type { SubmissionStatus } from "@/lib/forms/types";

export const SUBMISSION_LABEL: Record<SubmissionStatus, string> = { new: "New", done: "Done" };
export const SUBMISSION_BADGE: Record<SubmissionStatus, "default" | "success"> = { new: "default", done: "success" };
