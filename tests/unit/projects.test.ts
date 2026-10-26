import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  allTasksDone, completeTask, overdueTasks, progress, projectHealth, projectsReport, reopenTask, sortProjects, sortTasks, summarize, taskAlerts, taskState,
} from "@/lib/projects/logic";
import { sampleProjects } from "../support/projects-sample-data";
import { PROJECT_TEMPLATES, buildTasks, templateById, templateDueOn } from "@/lib/projects/templates";
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

describe("planning health", () => {
  it("shows planning until the start date passes, then flags it", () => {
    expect(projectHealth(project({ status: "planning", startOn: addDays(TODAY, 3) }), TODAY)).toBe("planning");
    expect(projectHealth(project({ status: "planning", startOn: addDays(TODAY, -1) }), TODAY)).toBe("at_risk");
    expect(projectHealth(project({ status: "planning", startOn: addDays(TODAY, -20), dueOn: addDays(TODAY, -1) }), TODAY)).toBe("late");
  });
});

describe("monthly repeats", () => {
  const monthly = (dueOn: string, over: Partial<Task> = {}) => task({ id: "m", repeat: "monthly", dueOn, ...over });
  it("returns to the original day after a short month", () => {
    const feb = completeTask([monthly("2026-01-31")], "m", "2026-01-31", "f1");
    const febTask = feb.find((t) => t.id === "f1")!;
    expect(febTask.dueOn).toBe("2026-02-28");
    const mar = completeTask(feb, "f1", "2026-02-28", "f2");
    expect(mar.find((t) => t.id === "f2")!.dueOn).toBe("2026-03-31");
  });
  it("rolls past today when completed late", () => {
    const out = completeTask([monthly("2026-01-15")], "m", "2026-04-20", "f");
    expect(out.find((t) => t.id === "f")!.dueOn).toBe("2026-05-15");
  });
});

describe("sorting", () => {
  const all = sampleProjects(TODAY);
  it("sorts projects by due date with completed last", () => {
    expect(sortProjects(all, "due", TODAY).map((p) => p.id)).toEqual(["p-2", "p-1", "p-3", "p-4"]);
  });
  it("sorts by health, then by name, never moving completed projects up", () => {
    expect(sortProjects(all, "health", TODAY).map((p) => p.id)).toEqual(["p-2", "p-1", "p-3", "p-4"]);
    expect(sortProjects(all, "name", TODAY).map((p) => p.name)).toEqual([
      "Client onboarding: Northwind", "Data cleanup", "License renewals 2026", "Quarterly bookkeeping",
    ]);
  });
  it("does not mutate its input", () => {
    const copy = [...all];
    sortProjects(all, "name", TODAY);
    expect(all).toEqual(copy);
  });
  it("orders open tasks by due date, undated last, then finished tasks newest first", () => {
    const tasks = [
      task({ id: "a", dueOn: null }), task({ id: "b", dueOn: "2026-11-01" }), task({ id: "c", dueOn: "2026-10-30" }),
      task({ id: "d", done: true, doneOn: "2026-10-01" }), task({ id: "e", done: true, doneOn: "2026-10-20" }),
    ];
    expect(sortTasks(tasks).map((t) => t.id)).toEqual(["c", "b", "a", "e", "d"]);
  });
});

describe("allTasksDone", () => {
  it("needs at least one task and all of them done", () => {
    expect(allTasksDone(project())).toBe(false);
    expect(allTasksDone(project({ tasks: [task({ done: true }), task({ id: "u" })] }))).toBe(false);
    expect(allTasksDone(project({ tasks: [task({ done: true })] }))).toBe(true);
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
  it("counts open and overdue tasks only on projects that are in play", () => {
    const held = all.map((p) => (p.id === "p-1" ? { ...p, status: "on_hold" as const } : p));
    expect(summarize(held, TODAY)).toMatchObject({ openTasks: 4, overdueTasks: 0 });
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

describe("project templates", () => {
  it("has unique ids and a sensible, valid checklist in each template", () => {
    expect(new Set(PROJECT_TEMPLATES.map((t) => t.id)).size).toBe(PROJECT_TEMPLATES.length);
    for (const t of PROJECT_TEMPLATES) {
      expect(t.tasks.length).toBeGreaterThanOrEqual(5);
      expect(new Set(t.tasks.map((x) => x.title)).size).toBe(t.tasks.length);
      for (const item of t.tasks) {
        expect(item.offsetDays).toBeGreaterThanOrEqual(0);
        expect(item.offsetDays).toBeLessThanOrEqual(t.durationDays);
        expect(taskFormSchema.safeParse({ title: item.title, assignee: "", dueOn: "2026-10-25", repeat: item.repeat ?? "none" }).success).toBe(true);
      }
    }
  });
  it("dates tasks from the start date and suggests a due date", () => {
    const t = templateById("vendor-onboarding")!;
    let n = 0;
    const tasks = buildTasks(t.tasks, "2026-11-01", () => `n${++n}`);
    expect(tasks).toHaveLength(t.tasks.length);
    expect(tasks[0]).toMatchObject({ id: "n1", dueOn: addDays("2026-11-01", t.tasks[0].offsetDays), done: false, assignee: "", repeat: "none" });
    expect(tasks.every((x) => x.dueOn! <= templateDueOn(t, "2026-11-01"))).toBe(true);
  });
  it("carries repeats through so completing one schedules the next", () => {
    const t = templateById("client-onboarding")!;
    const tasks = buildTasks(t.tasks, "2026-11-01", (() => { let i = 0; return () => `n${++i}`; })());
    const weekly = tasks.find((x) => x.repeat === "weekly")!;
    expect(completeTask(tasks, weekly.id, "2026-11-08", "next").find((x) => x.id === "next")!.dueOn).toBe("2026-11-15");
  });
});
