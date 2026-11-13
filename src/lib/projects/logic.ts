import { addDays, addMonths, advanceDay, daysBetween, formatDayLong, isDay } from "@/lib/dates";
import type { Milestone, Project, ProjectHealth, Task, TaskRepeat, TaskState } from "./types";

/** Tasks that belong to no project live in this built-in project. It is created on first use and never listed as a project. */
export const GENERAL_PROJECT_ID = "general";
export const isGeneral = (p: Project) => p.id === GENERAL_PROJECT_ID;
export function generalProject(today: string): Project {
  return { id: GENERAL_PROJECT_ID, name: "General tasks", client: "", description: "", status: "active", startOn: today, dueOn: addMonths(today, 120), tasks: [] };
}

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

/** True when the project has tasks and every one is done. */
export function allTasksDone(project: Project): boolean {
  return project.tasks.length > 0 && project.tasks.every((t) => t.done);
}

export function projectHealth(project: Project, today: string): ProjectHealth {
  if (project.status === "completed") return "completed";
  if (project.status === "on_hold") return "on_hold";
  if (project.dueOn < today) return "late";
  if (overdueTasks(project, today).length > 0) return "at_risk";
  if (project.status === "planning") return project.startOn < today ? "at_risk" : "planning";
  return "on_track";
}

const HEALTH_ORDER: ProjectHealth[] = ["late", "at_risk", "on_track", "planning", "on_hold", "completed"];

export type ProjectSort = "due" | "health" | "name";

/** A sorted copy. Completed projects always sink to the bottom; ties fall back to due date, then name. */
export function sortProjects(projects: Project[], sort: ProjectSort, today: string): Project[] {
  const byDue = (a: Project, b: Project) => a.dueOn.localeCompare(b.dueOn) || a.name.localeCompare(b.name);
  const key = (a: Project, b: Project) =>
    sort === "name" ? a.name.localeCompare(b.name)
    : sort === "health" ? HEALTH_ORDER.indexOf(projectHealth(a, today)) - HEALTH_ORDER.indexOf(projectHealth(b, today)) || byDue(a, b)
    : byDue(a, b);
  return [...projects].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || key(a, b));
}

/** Open tasks first (soonest due, undated last), then finished ones, most recently done first. */
export function sortTasks(tasks: Task[]): Task[] {
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
  const finished = tasks.filter((t) => t.done).sort((a, b) => (b.doneOn ?? "").localeCompare(a.doneOn ?? ""));
  return [...open, ...finished];
}

/** The occurrence after `due`. Monthly tasks keep their original day of month where the month is long enough. */
function nextDue(due: string, repeat: Exclude<TaskRepeat, "none">, anchor: number): string {
  if (repeat !== "monthly") return advanceDay(due, repeat);
  const first = addMonths(`${due.slice(0, 8)}01`, 1);
  const lastDay = Number(addDays(addMonths(first, 1), -1).slice(8));
  return `${first.slice(0, 8)}${String(Math.min(anchor, lastDay)).padStart(2, "0")}`;
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

  const anchor = task.anchorDay ?? Number(task.dueOn.slice(8));
  let next = nextDue(task.dueOn, task.repeat, anchor);
  for (let i = 0; i < 400 && next < today; i++) next = nextDue(next, task.repeat, anchor);
  const followUp: Task = { ...task, id: newId, dueOn: next, done: false, doneOn: null, followUpId: null, anchorDay: anchor };
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

export interface TaskItem { project: Project; task: Task; state: TaskState }

const URGENCY: Record<TaskState, number> = { overdue: 0, due_today: 1, due_soon: 2, open: 3, unscheduled: 4, done: 5 };

/**
 * Every task across all projects as one flat list. Open tasks come first, most urgent first (tasks in a
 * completed or on-hold project are left out, as in the summary); with `includeDone`, finished tasks follow, newest first.
 */
export function taskList(projects: Project[], today: string, includeDone = false): TaskItem[] {
  const open: TaskItem[] = [];
  const done: TaskItem[] = [];
  for (const project of projects) {
    const live = project.status !== "completed" && project.status !== "on_hold";
    for (const task of project.tasks) {
      if (task.done) { if (includeDone) done.push({ project, task, state: "done" }); }
      else if (live) open.push({ project, task, state: taskState(task, today) });
    }
  }
  open.sort((a, b) => URGENCY[a.state] - URGENCY[b.state] || (a.task.dueOn ?? "").localeCompare(b.task.dueOn ?? "") || a.task.title.localeCompare(b.task.title));
  done.sort((a, b) => (b.task.doneOn ?? "").localeCompare(a.task.doneOn ?? "") || a.task.title.localeCompare(b.task.title));
  return [...open, ...done];
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
    if (p.status === "active" && !isGeneral(p)) s.activeProjects++;
    for (const t of p.tasks) {
      if (t.done && t.doneOn?.startsWith(month)) s.completedThisMonth++;
      if (p.status === "completed" || p.status === "on_hold") continue;
      if (!t.done) s.openTasks++;
      if (taskState(t, today) === "overdue") s.overdueTasks++;
    }
  }
  return s;
}

const HEALTH_TEXT: Record<ProjectHealth, string> = {
  completed: "Completed", on_hold: "On hold", planning: "Planning", late: "Late", at_risk: "At risk", on_track: "On track",
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

// ---- milestones, updates and the recurring-work project

export const MAX_MILESTONES = 20;
export const MAX_UPDATES = 200;

export const milestonesOf = (p: Project): Milestone[] => [...(p.milestones ?? [])].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
export const updatesOf = (p: Project) => p.updates ?? [];

export function addMilestone(p: Project, m: { title: string; dueOn: string }, id: string): { project: Project } | { error: string } {
  const title = m.title.trim();
  if (!title) return { error: "Enter a name for the milestone." };
  if (title.length > 120) return { error: "Keep the name under 120 characters." };
  if (!isDay(m.dueOn)) return { error: "Choose a date for the milestone." };
  if ((p.milestones ?? []).length >= MAX_MILESTONES) return { error: `A project can have at most ${MAX_MILESTONES} milestones.` };
  return { project: { ...p, milestones: [...(p.milestones ?? []), { id, title, dueOn: m.dueOn, doneOn: null }] } };
}

export const toggleMilestone = (p: Project, id: string, today: string): Project => ({
  ...p, milestones: (p.milestones ?? []).map((m) => (m.id === id ? { ...m, doneOn: m.doneOn ? null : today } : m)),
});

export const removeMilestone = (p: Project, id: string): Project => ({ ...p, milestones: (p.milestones ?? []).filter((m) => m.id !== id) });

export function milestoneSummary(p: Project, today: string): { done: number; total: number; overdue: number; next: Milestone | null } {
  const all = milestonesOf(p);
  const open = all.filter((m) => !m.doneOn);
  return { done: all.length - open.length, total: all.length, overdue: open.filter((m) => m.dueOn < today).length, next: open[0] ?? null };
}

/** Adds a dated note to the project's log. Blank notes are refused. */
export function addUpdate(p: Project, u: { text: string; by: string; on: string }, id: string): Project {
  const text = u.text.trim().slice(0, 1000);
  if (!text) return p;
  return { ...p, updates: [...(p.updates ?? []), { id, on: u.on, by: u.by.trim().slice(0, 80) || "You", text }].slice(-MAX_UPDATES) };
}

/** The one project where repeating work lives. Every repeating task added from the project page or installed by setup goes here. */
export const RECURRING_PROJECT_ID = "recurring-work";
export const isRecurringProject = (p: Project) => p.id === RECURRING_PROJECT_ID;
