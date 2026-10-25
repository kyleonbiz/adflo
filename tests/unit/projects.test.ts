import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  completeTask, overdueTasks, progress, projectHealth, projectsReport, reopenTask, summarize, taskAlerts, taskState,
} from "@/lib/projects/logic";
import { sampleProjects } from "@/lib/projects/sample-data";
import type { Project, Task } from "@/lib/projects/types";
import { projectFormSchema, taskFormSchema } from "@/lib/projects/validation";

const TODAY = "2026-10-25";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t", title: "Do it", assignee: "", dueOn: null, repeat: "none", done: false, doneOn: null, followUpId: null, ...over,
});
const project = (over: Partial<Project> = {}): Project => ({
  id: "p", name: "Proj", client: "", description: "", status: "active",
  startOn: addDays(TODAY, -10), dueOn: addDays(TODAY, 10), tasks: [], ...over,
});

describe("taskState", () => {
  it("classifies by due date", () => {
    expect(taskState(task({ done: true, dueOn: addDays(TODAY, -9) }), TODAY)).toBe("done");
    expect(taskState(task(), TODAY)).toBe("unscheduled");
    expect(taskState(task({ dueOn: addDays(TODAY, -1) }), TODAY)).toBe("overdue");
    expect(taskState(task({ dueOn: TODAY }), TODAY)).toBe("due_today");
    expect(taskState(task({ dueOn: addDays(TODAY, 3) }), TODAY)).toBe("due_soon");
    expect(taskState(task({ dueOn: addDays(TODAY, 4) }), TODAY)).toBe("open");
  });
});

describe("progress", () => {
  it("rounds the percentage and handles an empty project", () => {
    expect(progress(project())).toEqual({ done: 0, total: 0, percent: 0 });
    expect(progress(project({ tasks: [task({ done: true }), task({ id: "b" }), task({ id: "c" })] }))).toEqual({ done: 1, total: 3, percent: 33 });
  });
});

describe("projectHealth", () => {
  it("is on track, at risk with an overdue task, late past the project due date", () => {
    expect(projectHealth(project(), TODAY)).toBe("on_track");
    expect(projectHealth(project({ tasks: [task({ dueOn: addDays(TODAY, -2) })] }), TODAY)).toBe("at_risk");
    expect(projectHealth(project({ dueOn: addDays(TODAY, -1) }), TODAY)).toBe("late");
  });
  it("completed and on-hold projects are never flagged", () => {
    const overdue = [task({ dueOn: addDays(TODAY, -2) })];
    expect(projectHealth(project({ status: "completed", dueOn: addDays(TODAY, -9), tasks: overdue }), TODAY)).toBe("completed");
    expect(projectHealth(project({ status: "on_hold", tasks: overdue }), TODAY)).toBe("on_hold");
  });
});

describe("completeTask", () => {
  it("completes a one-off task without spawning anything", () => {
    const out = completeTask([task({ dueOn: TODAY })], "t", TODAY, "n1");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ done: true, doneOn: TODAY });
  });
  it("spawns the next occurrence of a repeating task", () => {
    const out = completeTask([task({ dueOn: addDays(TODAY, 2), repeat: "weekly" })], "t", TODAY, "n1");
    expect(out).toHaveLength(2);
    expect(out[0].followUpId).toBe("n1");
    expect(out[1]).toMatchObject({ id: "n1", dueOn: addDays(TODAY, 9), done: false, followUpId: null });
  });
  it("rolls a late repeating task forward past today", () => {
    const out = completeTask([task({ dueOn: addDays(TODAY, -20), repeat: "weekly" })], "t", TODAY, "n1");
    expect(out[1].dueOn).toBe(addDays(TODAY, 1)); // -20 + 3 weeks
    expect(out[1].dueOn! >= TODAY).toBe(true);
  });
  it("does not spawn twice when a task is reopened and completed again", () => {
    let tasks = completeTask([task({ dueOn: TODAY, repeat: "daily" })], "t", TODAY, "n1");
    tasks = reopenTask(tasks, "t");
    expect(tasks.find((t) => t.id === "t")).toMatchObject({ done: false, doneOn: null, followUpId: "n1" });
    tasks = completeTask(tasks, "t", TODAY, "n2");
    expect(tasks).toHaveLength(2);
  });
  it("ignores unknown or already-done tasks and undated repeating tasks", () => {
    const tasks = [task({ done: true })];
    expect(completeTask(tasks, "t", TODAY, "n")).toBe(tasks);
    expect(completeTask(tasks, "nope", TODAY, "n")).toBe(tasks);
    expect(completeTask([task({ repeat: "weekly" })], "t", TODAY, "n")).toHaveLength(1);
  });
});

describe("portfolio", () => {
  const all = sampleProjects(TODAY);
  it("lists alerts overdue first, skipping completed projects", () => {
    const alerts = taskAlerts(all, TODAY);
    expect(alerts.map((a) => [a.task.title, a.state])).toEqual([
      ["Import vendor list", "overdue"],
      ["Submit city permit renewal", "due_today"],
      ["Configure invoice templates", "due_soon"],
      ["Weekly check-in", "due_soon"],
    ]);
  });
  it("skips on-hold projects too", () => {
    const held = all.map((p) => ({ ...p, status: "on_hold" as const }));
    expect(taskAlerts(held, TODAY)).toEqual([]);
  });
  it("summarizes the sample data", () => {
    expect(summarize(all, TODAY)).toEqual({ activeProjects: 2, openTasks: 8, overdueTasks: 1, completedThisMonth: 4 });
  });
  it("finds overdue tasks per project", () => {
    expect(overdueTasks(all[0], TODAY).map((t) => t.title)).toEqual(["Import vendor list"]);
  });
});

describe("projectsReport", () => {
  it("includes health, progress and grouped tasks", () => {
    const text = projectsReport([sampleProjects(TODAY)[0]], TODAY);
    expect(text).toContain("PROJECT STATUS REPORT, Oct 25, 2026");
    expect(text).toContain("CLIENT ONBOARDING: NORTHWIND");
    expect(text).toContain("Health: At risk");
    expect(text).toContain("Progress: 2 of 6 tasks complete (33%)");
    expect(text).toContain("Overdue (1):\n- Import vendor list (Priya), 2 days overdue");
    expect(text).toContain("Completed (2):");
  });
  it("marks a late project", () => {
    expect(projectsReport([sampleProjects(TODAY)[1]], TODAY)).toContain("(4 days late)");
  });
});

describe("forms", () => {
  it("validates project dates", () => {
    const ok = { name: "Cleanup", client: "", description: "", status: "active", startOn: "2026-10-01", dueOn: "2026-10-31" };
    expect(projectFormSchema.safeParse(ok).success).toBe(true);
    expect(projectFormSchema.safeParse({ ...ok, dueOn: "2026-09-01" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...ok, name: "x" }).success).toBe(false);
  });
  it("requires a due date for repeating tasks only", () => {
    expect(taskFormSchema.safeParse({ title: "A", assignee: "", dueOn: "", repeat: "none" }).success).toBe(true);
    expect(taskFormSchema.safeParse({ title: "A", assignee: "", dueOn: "", repeat: "weekly" }).success).toBe(false);
    expect(taskFormSchema.safeParse({ title: "", assignee: "", dueOn: "", repeat: "none" }).success).toBe(false);
    expect(taskFormSchema.safeParse({ title: "A", assignee: "", dueOn: "2026-02-30", repeat: "none" }).success).toBe(false);
  });
});
