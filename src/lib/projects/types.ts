export const PROJECT_STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];

export const TASK_REPEATS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;
export type TaskRepeat = (typeof TASK_REPEATS)[number]["value"];

/** Dates are `YYYY-MM-DD`. */
export interface Task {
  id: string;
  title: string;
  assignee: string;
  dueOn: string | null;
  repeat: TaskRepeat;
  done: boolean;
  doneOn: string | null;
  /** Set once a repeating task has spawned its next occurrence, so reopening and re-completing never duplicates it. */
  followUpId: string | null;
  /** Day of month a monthly task is anchored to, so a Jan 31 task returns to the 31st after February's 28th. */
  anchorDay?: number;
}

/** A dated note on how the project is going. Oldest first. */
export interface ProjectUpdate {
  id: string;
  on: string;
  by: string;
  text: string;
}

/** A checkpoint in the project: bigger than a task, with its own date. */
export interface Milestone {
  id: string;
  title: string;
  dueOn: string;
  doneOn: string | null;
}

/** Who or what a project is for, so you can jump from the project to that person's or vendor's page. */
export interface ProjectLink {
  kind: "contact" | "vendor";
  name: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
  startOn: string;
  dueOn: string;
  tasks: Task[];
  /** The person accountable for the project as a whole. */
  owner?: string;
  linked?: ProjectLink | null;
  milestones?: Milestone[];
  updates?: ProjectUpdate[];
}

export type TaskState = "done" | "overdue" | "due_today" | "due_soon" | "open" | "unscheduled";
export type ProjectHealth = "completed" | "on_hold" | "planning" | "late" | "at_risk" | "on_track";
