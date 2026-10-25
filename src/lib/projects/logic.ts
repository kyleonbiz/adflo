import { advanceDay, daysBetween, formatDayLong } from "@/lib/dates";
import type { Project, ProjectHealth, Task, TaskState } from "./types";

/** An open task due within this many days is "due soon". */
export const DUE_SOON_DAYS = 3;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function taskState(task: Task, today: string): TaskState {
  if (task.done) return "done";
  if (!task.dueOn) return "unscheduled";
  const left = daysBetween(today, task.dueOn);
  if (left < 0) return "overdue";
  if (left === 0) return "due_today";
  return left <= DUE_SOON_DAYS ? "due_soon" : "open";
}

export function progress(project: Project): { done: number; total: number; percent: number } {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function overdueTasks(project: Project, today: string): Task[] {
  return project.tasks.filter((t) => taskState(t, today) === "overdue");
}

export function projectHealth(project: Project, today: string): ProjectHealth {
  if (project.status === "completed") return "completed";
  if (project.status === "on_hold") return "on_hold";
  if (project.dueOn < today) return "late";
  return overdueTasks(project, today).length > 0 ? "at_risk" : "on_track";
}

/**
 * Completes a task. A repeating task with a due date gets its next occurrence (rolled forward past
 * `today` if it was completed late) unless it already spawned one. Returns the updated task list.
 */
export function completeTask(tasks: Task[], taskId: string, today: string, newId: string): Task[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.done) return tasks;
  const done = tasks.map((t) => (t.id === taskId ? { ...t, done: true, doneOn: today } : t));
  if (task.repeat === "none" || !task.dueOn || task.followUpId) return done;

  let next = advanceDay(task.dueOn, task.repeat);
  for (let i = 0; i < 400 && next < today; i++) next = advanceDay(next, task.repeat);
  const followUp: Task = { ...task, id: newId, dueOn: next, done: false, doneOn: null, followUpId: null };
  return [...done.map((t) => (t.id === taskId ? { ...t, followUpId: newId } : t)), followUp];
}

export function reopenTask(tasks: Task[], taskId: string): Task[] {
  return tasks.map((t) => (t.id === taskId ? { ...t, done: false, doneOn: null } : t));
}

export interface TaskAlert {
  projectId: string;
  projectName: string;
  task: Task;
  state: "overdue" | "due_today" | "due_soon";
  daysLeft: number;
}

/** Open tasks across active projects that need action, overdue first and oldest first. */
export function taskAlerts(projects: Project[], today: string): TaskAlert[] {
  const rank = { overdue: 0, due_today: 1, due_soon: 2 } as const;
  const out: TaskAlert[] = [];
  for (const p of projects) {
    if (p.status === "completed" || p.status === "on_hold") continue;
    for (const task of p.tasks) {
      const state = taskState(task, today);
      if (state === "overdue" || state === "due_today" || state === "due_soon") {
        out.push({ projectId: p.id, projectName: p.name, task, state, daysLeft: daysBetween(today, task.dueOn!) });
      }
    }
  }
  return out.sort((a, b) => rank[a.state] - rank[b.state] || a.daysLeft - b.daysLeft);
}

export interface PortfolioSummary {
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  completedThisMonth: number;
}

export function summarize(projects: Project[], today: string): PortfolioSummary {
  const month = today.slice(0, 7);
  const s: PortfolioSummary = { activeProjects: 0, openTasks: 0, overdueTasks: 0, completedThisMonth: 0 };
  for (const p of projects) {
    if (p.status === "active") s.activeProjects++;
    for (const t of p.tasks) {
      if (t.done && t.doneOn?.startsWith(month)) s.completedThisMonth++;
      if (!t.done && p.status !== "completed") s.openTasks++;
      if (taskState(t, today) === "overdue" && p.status !== "completed" && p.status !== "on_hold") s.overdueTasks++;
    }
  }
  return s;
}

const HEALTH_TEXT: Record<ProjectHealth, string> = {
  completed: "Completed", on_hold: "On hold", late: "Late", at_risk: "At risk", on_track: "On track",
};

function taskLine(t: Task, today: string): string {
  const who = t.assignee ? ` (${t.assignee})` : "";
  const state = taskState(t, today);
  if (state === "done") return `- ${t.title}${who}, done ${formatDayLong(t.doneOn ?? today)}`;
  if (!t.dueOn) return `- ${t.title}${who}`;
  const left = daysBetween(today, t.dueOn);
  const when = state === "overdue" ? `${plural(-left, "day")} overdue` : left === 0 ? "due today" : `due ${formatDayLong(t.dueOn)}`;
  return `- ${t.title}${who}, ${when}`;
}

/** Plain-text status report for one or more projects. */
export function projectsReport(projects: Project[], today: string): string {
  const header = `PROJECT STATUS REPORT, ${formatDayLong(today)}`;
  const sections = projects.map((p) => {
    const { done, total, percent } = progress(p);
    const left = daysBetween(today, p.dueOn);
    const due = p.status === "completed" ? "" : left < 0 ? ` (${plural(-left, "day")} late)` : ` (${plural(left, "day")} left)`;
    const overdue = p.tasks.filter((t) => taskState(t, today) === "overdue");
    const upcoming = p.tasks.filter((t) => ["due_today", "due_soon", "open", "unscheduled"].includes(taskState(t, today)));
    const completed = p.tasks.filter((t) => t.done);
    const block = (title: string, list: Task[]) =>
      list.length ? [`${title} (${list.length}):`, ...list.map((t) => taskLine(t, today)), ""] : [];
    return [
      p.name.toUpperCase(),
      `Client: ${p.client || "n/a"}`,
      `Status: ${p.status.replace("_", " ")}. Health: ${HEALTH_TEXT[projectHealth(p, today)]}`,
      `Dates: ${formatDayLong(p.startOn)} to ${formatDayLong(p.dueOn)}${due}`,
      `Progress: ${done} of ${total} tasks complete (${percent}%)`,
      "",
      ...block("Overdue", overdue),
      ...block("Upcoming", upcoming),
      ...block("Completed", completed),
    ].join("\n");
  });
  return [header, "", ...sections.map((s) => s.trimEnd()).flatMap((s) => [s, "", "-----", ""])].join("\n").trimEnd() + "\n";
}
