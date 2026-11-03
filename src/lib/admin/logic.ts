import { advance, currentApprover, startProgress } from "@/lib/approvals/chain";
import { advanceDay, daysBetween, formatDayLong } from "@/lib/dates";
import type { CalendarEvent } from "./ics";
import { approvalReasons } from "./triage";
import type { AdminRequest, Category, Priority, RequestSource, RequestStatus, Routine } from "./types";

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
export function createRequest(input: NewRequest, today: string, id: string, chain: string[] = []): AdminRequest {
  const reasons = approvalReasons(input.title, input.description, input.category);
  const request: AdminRequest = {
    ...input, id, status: reasons.length > 0 ? "pending_approval" : "open", approvalReasons: reasons,
    decidedBy: null, decidedOn: null, comment: "", createdOn: today, doneOn: null,
  };
  if (reasons.length > 0 && chain.length > 0) request.approval = startProgress(chain, VENDOR_FALLBACK);
  return request;
}

const VENDOR_FALLBACK = "Operations manager";

/**
 * Approve (becomes open) or decline a request that is waiting. With an approval chain, an approval
 * moves it to the next approver and it only opens after the last; a decline ends it at once.
 * Anything not waiting is returned unchanged.
 */
export function decide(r: AdminRequest, decision: "approved" | "declined", by: string, today: string, comment = ""): AdminRequest {
  if (r.status !== "pending_approval") return r;
  if (r.approval && currentApprover(r.approval) !== null) {
    const { progress, outcome } = advance(r.approval, decision, today, comment);
    if (outcome === "pending") return { ...r, approval: progress };
    const last = progress.log[progress.log.length - 1];
    return { ...r, approval: progress, status: outcome === "approved" ? "open" : "declined", decidedBy: last.by, decidedOn: today, comment: comment.trim() };
  }
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

// --- Routines ----------------------------------------------------------------

export const dueRoutines = (routines: Routine[], today: string) => routines.filter((r) => r.nextDueOn <= today);

/**
 * Creates one request for every routine that is due and moves it to its next date after `today`
 * (a routine that missed several runs still creates a single request, not a pile).
 */
export function runRoutines(
  routines: Routine[], today: string, newId: () => string,
): { routines: Routine[]; created: AdminRequest[] } {
  const created: AdminRequest[] = [];
  const next = routines.map((r) => {
    if (r.nextDueOn > today) return r;
    created.push(createRequest({
      title: r.title, description: r.description, requester: "Recurring task", category: r.category,
      priority: "normal", dueOn: r.nextDueOn, source: "recurring",
    }, today, newId()));
    let due = advanceDay(r.nextDueOn, r.every);
    for (let i = 0; i < 1000 && due <= today; i++) due = advanceDay(due, r.every);
    return { ...r, nextDueOn: due };
  });
  return { routines: next, created };
}

// --- Notifications -------------------------------------------------------------

export interface Notification {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

/** A request waiting on a decision this long is flagged, because unanswered approvals are where admin work quietly dies. */
export const STALE_APPROVAL_DAYS = 5;
/** An open request nobody has started, with no due date to force it, is flagged after this long. */
export const STALE_OPEN_DAYS = 7;

/** Requests going quiet: approvals nobody answered, and work nobody started. */
export function stuckRequests(requests: AdminRequest[], today: string): { request: AdminRequest; reason: "approval" | "unstarted"; days: number }[] {
  const out: { request: AdminRequest; reason: "approval" | "unstarted"; days: number }[] = [];
  for (const r of requests) {
    const days = daysBetween(r.createdOn, today);
    if (r.status === "pending_approval" && days >= STALE_APPROVAL_DAYS) out.push({ request: r, reason: "approval", days });
    else if (r.status === "open" && !r.dueOn && days >= STALE_OPEN_DAYS) out.push({ request: r, reason: "unstarted", days });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** What the daily digest would say today, most urgent first. */
export function notifications(requests: AdminRequest[], routines: Routine[], today: string): Notification[] {
  const out: Notification[] = [];
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  for (const r of requests) {
    if (isOverdue(r, today)) out.push({ id: `o-${r.id}`, severity: "critical", message: `"${r.title}" is ${plural(daysBetween(r.dueOn!, today), "day")} overdue.` });
    else if (isActive(r) && r.dueOn === today) out.push({ id: `d-${r.id}`, severity: "warning", message: `"${r.title}" is due today.` });
    else if (r.status === "pending_approval") {
      const days = daysBetween(r.createdOn, today);
      const stale = days >= STALE_APPROVAL_DAYS;
      out.push({ id: `a-${r.id}`, severity: stale || r.priority === "high" ? "warning" : "info", message: `"${r.title}" is waiting for approval${stale ? ` (${plural(days, "day")} so far)` : ""}.` });
    } else if (r.status === "open" && !r.dueOn && daysBetween(r.createdOn, today) >= STALE_OPEN_DAYS) {
      out.push({ id: `u-${r.id}`, severity: "info", message: `"${r.title}" has not been started in ${plural(daysBetween(r.createdOn, today), "day")} and has no due date.` });
    }
  }
  const due = dueRoutines(routines, today);
  if (due.length > 0) out.push({ id: "routines", severity: "info", message: `${plural(due.length, "recurring task")} due: ${due.map((r) => r.title).join(", ")}.` });
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export interface AdminSummary { open: number; pendingApproval: number; overdue: number; routinesDue: number }

export function summarize(requests: AdminRequest[], routines: Routine[], today: string): AdminSummary {
  return {
    open: requests.filter(isActive).length,
    pendingApproval: requests.filter((r) => r.status === "pending_approval").length,
    overdue: requests.filter((r) => isOverdue(r, today)).length,
    routinesDue: dueRoutines(routines, today).length,
  };
}

/** Calendar entries for active requests with a due date and for every routine's next date. */
export function calendarEvents(requests: AdminRequest[], routines: Routine[]): CalendarEvent[] {
  return [
    ...requests.filter((r) => isActive(r) && r.dueOn).map((r) => ({
      uid: `request-${r.id}`, day: r.dueOn!, summary: r.title,
      description: [r.description, `Category: ${r.category}. Priority: ${r.priority}.`].filter(Boolean).join("\n"),
    })),
    ...routines.map((r) => ({ uid: `routine-${r.id}`, day: r.nextDueOn, summary: `Recurring: ${r.title}`, description: r.description || undefined })),
  ];
}

export const EVERY_TEXT: Record<Routine["every"], string> = { weekly: "every week", monthly: "every month", quarterly: "every quarter", yearly: "every year" };
export const dueText = (day: string, today: string) => {
  const left = daysBetween(today, day);
  return left < 0 ? `${-left} day${left === -1 ? "" : "s"} overdue` : left === 0 ? "today" : formatDayLong(day);
};
