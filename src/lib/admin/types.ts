export const CATEGORIES = [
  "Scheduling", "Documents", "Finance & payments", "Accounts & access", "Vendors & purchasing",
  "IT & equipment", "HR & people", "General",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["low", "normal", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type RequestStatus = "pending_approval" | "open" | "in_progress" | "done" | "declined";
export type RequestSource = "manual" | "email" | "recurring";

import type { ApprovalProgress } from "@/lib/approvals/chain";

/** Dates are `YYYY-MM-DD`. */
export interface AdminRequest {
  id: string;
  title: string;
  description: string;
  requester: string;
  category: Category;
  priority: Priority;
  dueOn: string | null;
  status: RequestStatus;
  source: RequestSource;
  /** Why the request needed approval; empty when it did not. */
  approvalReasons: string[];
  decidedBy: string | null;
  decidedOn: string | null;
  comment: string;
  createdOn: string;
  doneOn: string | null;
  /** Who has to sign off, in order, and who already has. Set when the request needs approval. */
  approval?: ApprovalProgress;
}

export const EVERY = [
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every quarter" },
  { value: "yearly", label: "Every year" },
] as const;
export type Every = (typeof EVERY)[number]["value"];

export interface Routine {
  id: string;
  title: string;
  description: string;
  category: Category;
  every: Every;
  nextDueOn: string;
}
