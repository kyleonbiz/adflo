"use client";

import { useState } from "react";
import { ChevronDown, Download, Pencil, Plus, Repeat, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { daysBetween, formatDayLong } from "@/lib/dates";
import { progress, projectHealth, taskState } from "@/lib/projects/logic";
import { PROJECT_STATUSES, TASK_REPEATS, type Project, type ProjectStatus, type Task } from "@/lib/projects/types";
import { taskFormSchema, type TaskFormValues } from "@/lib/projects/validation";
import { cn } from "@/lib/utils";
import { HEALTH_BADGE, HEALTH_LABEL, STATUS_LABEL, TASK_BADGE } from "./status";

export interface ProjectActions {
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onStatus: (project: Project, status: ProjectStatus) => void;
  onReport: (project: Project) => void;
  onToggleTask: (project: Project, task: Task) => void;
  onAddTask: (project: Project, values: TaskFormValues) => void;
  onRemoveTask: (project: Project, task: Task) => void;
}

function dueText(task: Task, today: string): string {
  if (!task.dueOn) return "";
  const left = daysBetween(today, task.dueOn);
  if (task.done) return `done ${formatDayLong(task.doneOn ?? task.dueOn)}`;
  if (left < 0) return `${-left} day${left === -1 ? "" : "s"} overdue`;
  if (left === 0) return "due today";
  return `due ${formatDayLong(task.dueOn)}`;
}

function AddTaskForm({ project, onAdd }: { project: Project; onAdd: (values: TaskFormValues) => void }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = taskFormSchema.safeParse({ title, assignee, dueOn, repeat });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        onAdd(parsed.data);
        setTitle(""); setAssignee(""); setDueOn(""); setRepeat("none"); setError("");
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9.5rem_9.5rem_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" aria-label={`New task for ${project.name}`} className="h-9" maxLength={160} />
        <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee" aria-label="Assignee" className="h-9" maxLength={80} />
        <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label="Task due date" className="h-9" />
        <Select value={repeat} onValueChange={setRepeat}>
          <SelectTrigger aria-label="Task repeat" className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{TASK_REPEATS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline" className="h-9"><Plus /> Add</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

export function ProjectCard({ project, today, actions }: { project: Project; today: string; actions: ProjectActions }) {
  const [open, setOpen] = useState(false);
  const health = projectHealth(project, today);
  const { done, total, percent } = progress(project);
  const panelId = `proj-tasks-${project.id}`;

  return (
    <li className="rounded-2xl border bg-card shadow-panel" data-testid="project-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{project.name}</h3>
            <Badge variant={HEALTH_BADGE[health]}>{HEALTH_LABEL[health]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[project.client, `${formatDayLong(project.startOn)} to ${formatDayLong(project.dueOn)}`].filter(Boolean).join(" · ")}
          </p>
          {project.description && <p className="text-sm">{project.description}</p>}
          <div className="flex items-center gap-3">
            <Progress value={percent} className="max-w-xs" aria-label={`${project.name} progress`} />
            <span className="text-xs text-muted-foreground">{done} of {total} tasks · {percent}%</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <div className="w-36">
            <Select value={project.status} onValueChange={(v) => actions.onStatus(project, v as ProjectStatus)}>
              <SelectTrigger aria-label={`Status of ${project.name}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{STATUS_LABEL[s.value]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label={`Download report for ${project.name}`} onClick={() => actions.onReport(project)}><Download /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${project.name}`} onClick={() => actions.onEdit(project)}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${project.name}`} onClick={() => actions.onDelete(project)}><Trash2 /></Button>
        </div>
      </div>

      <div className="border-t">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-muted/50"
        >
          <span>Tasks <span className="font-normal text-muted-foreground">{total === 0 ? "none yet" : `${total - done} open`}</span></span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div id={panelId} className="space-y-3 px-4 pb-4">
            {project.tasks.length > 0 && (
              <ul className="space-y-1">
                {project.tasks.map((t) => {
                  const state = taskState(t, today);
                  return (
                    <li key={t.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/50">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => actions.onToggleTask(project, t)}
                          className="size-4 shrink-0 rounded border-input accent-primary"
                        />
                        <span className={cn("truncate", t.done && "text-muted-foreground line-through")}>{t.title}</span>
                        {t.repeat !== "none" && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label={`Repeats ${t.repeat}`} />}
                      </label>
                      {t.assignee && <span className="hidden text-xs text-muted-foreground sm:inline">{t.assignee}</span>}
                      {t.dueOn && (
                        <Badge variant={TASK_BADGE[state] ?? "muted"}>{dueText(t, today)}</Badge>
                      )}
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove task ${t.title}`} onClick={() => actions.onRemoveTask(project, t)}><X /></Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <AddTaskForm project={project} onAdd={(values) => actions.onAddTask(project, values)} />
          </div>
        )}
      </div>
    </li>
  );
}
