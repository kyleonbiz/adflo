import type { ProjectHealth, ProjectStatus, TaskState } from "@/lib/projects/types";

export const HEALTH_LABEL: Record<ProjectHealth, string> = {
  completed: "Completed", on_hold: "On hold", late: "Late", at_risk: "At risk", on_track: "On track",
};
export const HEALTH_BADGE: Record<ProjectHealth, "success" | "muted" | "danger" | "warning"> = {
  completed: "success", on_hold: "muted", late: "danger", at_risk: "warning", on_track: "success",
};
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning", active: "Active", on_hold: "On hold", completed: "Completed",
};
export const TASK_BADGE: Partial<Record<TaskState, "danger" | "warning" | "default">> = {
  overdue: "danger", due_today: "warning", due_soon: "default",
};
