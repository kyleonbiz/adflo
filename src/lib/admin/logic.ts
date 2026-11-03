import { daysBetween, formatDayLong } from "@/lib/dates";
import type { CalendarEvent } from "./ics";
import { approvalReasons } from "./triage";
import type { AdminRequest, Category, Priority, RequestSource, RequestStatus } from "./types";

export interface NewRequest {
  title: string;
  description: string;
  requester: string;
  category: Category;
  priority: Priority;
  dueOn: string | null;
  source: RequestSource;
}

/** A request that trips an approval rule waits for a decision; anything else is open straight away. */
export function createRequest(input: NewRequest, today: string, id: string): AdminRequest {
  const reasons = approvalReasons(input.title, input.description, input.category);
  return {
    ...input, id, status: reasons.length > 0 ? "pending_approval" : "open", approvalReasons: reasons,
    decidedBy: null, decidedOn: null, comment: "", createdOn: today, doneOn: null,
  };
}

/** Approve (becomes open) or decline a request that is waiting. Anything else is returned unchanged. */
export function decide(r: AdminRequest, decision: "approved" | "declined", by: string, today: string, comment = ""): AdminRequest {
  if (r.status !== "pending_approval") return r;
  return { ...r, status: decision === "approved" ? "open" : "declined", decidedBy: by, decidedOn: today, comment: comment.trim() };
}

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending_approval: [],
  open: ["in_progress", "done"],
  in_progress: ["open", "done"],
  done: ["open"],
  declined: [],
};

/** Moves a request between working states. Approval and declining go through `decide` only. */
export function setStatus(r: AdminRequest, status: RequestStatus, today: string): AdminRequest {
  if (!TRANSITIONS[r.status].includes(status)) return r;
  return { ...r, status, doneOn: status === "done" ? today : null };
}

export const isActive = (r: AdminRequest) => r.status === "open" || r.status === "in_progress";
export const isOverdue = (r: AdminRequest, today: string) => isActive(r) && r.dueOn !== null && r.dueOn < today;

// --- Notifications -------------------------------------------------------------

export interface Notification {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

/** What the daily digest would say today, most urgent first. */
export function notifications(requests: AdminRequest[], today: string): Notification[] {
  const out: Notification[] = [];
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  for (const r of requests) {
    if (isOverdue(r, today)) out.push({ id: `o-${r.id}`, severity: "critical", message: `"${r.title}" is ${plural(daysBetween(r.dueOn!, today), "day")} overdue.` });
    else if (isActive(r) && r.dueOn === today) out.push({ id: `d-${r.id}`, severity: "warning", message: `"${r.title}" is due today.` });
    else if (r.status === "pending_approval") out.push({ id: `a-${r.id}`, severity: r.priority === "high" ? "warning" : "info", message: `"${r.title}" is waiting for approval.` });
  }
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export interface AdminSummary { open: number; pendingApproval: number; overdue: number }

export function summarize(requests: AdminRequest[], today: string): AdminSummary {
  return {
    open: requests.filter(isActive).length,
    pendingApproval: requests.filter((r) => r.status === "pending_approval").length,
    overdue: requests.filter((r) => isOverdue(r, today)).length,
  };
}

/** Calendar entries for active requests with a due date. */
export function calendarEvents(requests: AdminRequest[]): CalendarEvent[] {
  return [
    ...requests.filter((r) => isActive(r) && r.dueOn).map((r) => ({
      uid: `request-${r.id}`, day: r.dueOn!, summary: r.title,
      description: [r.description, `Category: ${r.category}. Priority: ${r.priority}.`].filter(Boolean).join("\n"),
    })),
  ];
}

export const dueText = (day: string, today: string) => {
  const left = daysBetween(today, day);
  return left < 0 ? `${-left} day${left === -1 ? "" : "s"} overdue` : left === 0 ? "today" : formatDayLong(day);
};
