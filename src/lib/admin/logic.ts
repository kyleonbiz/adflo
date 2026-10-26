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

/** What the daily digest would say today, most urgent first. */
export function notifications(requests: AdminRequest[], routines: Routine[], today: string): Notification[] {
  const out: Notification[] = [];
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  for (const r of requests) {
    if (isOverdue(r, today)) out.push({ id: `o-${r.id}`, severity: "critical", message: `"${r.title}" is ${plural(daysBetween(r.dueOn!, today), "day")} overdue.` });
    else if (isActive(r) && r.dueOn === today) out.push({ id: `d-${r.id}`, severity: "warning", message: `"${r.title}" is due today.` });
    else if (r.status === "pending_approval") out.push({ id: `a-${r.id}`, severity: r.priority === "high" ? "warning" : "info", message: `"${r.title}" is waiting for approval.` });
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
