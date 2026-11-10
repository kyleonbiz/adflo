"use client";

import { useId, useState } from "react";
import { RemindMenu } from "@/components/modules/remind-menu";
import { CheckCircle2, ChevronDown, Download, Flag, MoreHorizontal, Pencil, Plus, Repeat, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { daysBetween, formatDayLong } from "@/lib/dates";
import Link from "next/link";
import { allTasksDone, isRecurringProject, milestoneSummary, milestonesOf, overdueTasks, progress, projectHealth, sortTasks, taskState, updatesOf } from "@/lib/projects/logic";
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
  onEditTask: (project: Project, task: Task, values: TaskFormValues) => void;
  onRemoveTask: (project: Project, task: Task) => void;
  onAddMilestone: (project: Project, title: string, dueOn: string) => string | null;
  onToggleMilestone: (project: Project, id: string) => void;
  onRemoveMilestone: (project: Project, id: string) => void;
  onAddUpdate: (project: Project, text: string) => void;
}

/** Where to go to see the contact or vendor a project is for. */
export const linkHref = (p: Project): string | null =>
  p.linked ? `${p.linked.kind === "vendor" ? "/app/vendors" : "/app/contacts"}?q=${encodeURIComponent(p.linked.name)}` : null;

function MilestonesAndUpdates({ project, today, actions }: { project: Project; today: string; actions: ProjectActions }) {
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const milestones = milestonesOf(project);
  const updates = [...updatesOf(project)].reverse();
  const ms = milestoneSummary(project, today);
  return (
    <div className="grid gap-4 border-t pt-3 lg:grid-cols-2">
      <section aria-label={`Milestones for ${project.name}`} className="min-w-0 space-y-2" data-testid="milestones">
        <h4 className="flex items-center gap-2 text-sm font-medium"><Flag className="size-4 text-muted-foreground" aria-hidden /> Milestones{ms.total > 0 && <span className="font-normal text-muted-foreground">{ms.done} of {ms.total}{ms.overdue > 0 ? `, ${ms.overdue} overdue` : ""}</span>}</h4>
        {milestones.length === 0 ? <p className="text-xs text-muted-foreground">No milestones yet. Add the dates that matter, like sign-off or launch.</p> : (
          <ul className="space-y-1">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm" data-testid="milestone">
                <input type="checkbox" checked={!!m.doneOn} onChange={() => actions.onToggleMilestone(project, m.id)} aria-label={`${m.title} done`} className="size-4 rounded border-input accent-primary" />
                <span className={cn("min-w-0 flex-1 break-words", m.doneOn && "text-muted-foreground line-through")}>{m.title}</span>
                <span className={cn("shrink-0 text-xs", !m.doneOn && m.dueOn < today ? "font-medium text-destructive" : "text-muted-foreground")}>{m.doneOn ? `done ${formatDayLong(m.doneOn)}` : formatDayLong(m.dueOn)}</span>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove milestone ${m.title}`} onClick={() => actions.onRemoveMilestone(project, m.id)}><X /></Button>
              </li>
            ))}
          </ul>
        )}
        <form className="flex flex-wrap items-center gap-2" noValidate onSubmit={(e) => {
          e.preventDefault();
          const problem = actions.onAddMilestone(project, title, dueOn);
          if (problem) return setError(problem);
          setTitle(""); setDueOn(""); setError("");
        }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Milestone" aria-label={`New milestone for ${project.name}`} className="h-9 min-w-32 flex-1" />
          <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label={`Milestone date for ${project.name}`} className="h-9 w-40" />
          <Button type="submit" size="sm" variant="outline" className="h-9" aria-label={`Add milestone to ${project.name}`}><Plus /> Add</Button>
        </form>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </section>
      <section aria-label={`Updates for ${project.name}`} className="min-w-0 space-y-2" data-testid="updates">
        <h4 className="text-sm font-medium">Updates</h4>
        <form className="flex flex-wrap items-center gap-2" noValidate onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; actions.onAddUpdate(project, note); setNote(""); }}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What changed? Who said what?" aria-label={`Add an update to ${project.name}`} className="h-9 min-w-40 flex-1" />
          <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!note.trim()}>Post</Button>
        </form>
        {updates.length === 0 ? <p className="text-xs text-muted-foreground">Nothing posted yet. Updates stay with the project, newest first.</p> : (
          <ol className="max-h-48 space-y-1.5 overflow-y-auto">
            {updates.map((u) => (
              <li key={u.id} className="text-sm" data-testid="update"><span className="text-xs text-muted-foreground">{formatDayLong(u.on)} · {u.by}</span><span className="block break-words">{u.text}</span></li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function dueText(task: Task, today: string): string {
  if (!task.dueOn) return "";
  const left = daysBetween(today, task.dueOn);
  if (task.done) return `done ${formatDayLong(task.doneOn ?? task.dueOn)}`;
  if (left < 0) return `${-left} day${left === -1 ? "" : "s"} overdue`;
  if (left === 0) return "due today";
  return `due ${formatDayLong(task.dueOn)}`;
}

const BORDER: Partial<Record<ReturnType<typeof projectHealth>, string>> = {
  late: "border-l-red-500",
  at_risk: "border-l-amber-400",
};

/** Add a task, or edit one when `task` is given. */
export function TaskForm({ project, task, onSubmit, onCancel }: {
  project: Project;
  task?: Task;
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
}) {
  const uid = useId();
  const [title, setTitle] = useState(task?.title ?? "");
  const [assignee, setAssignee] = useState(task?.assignee ?? "");
  const [dueOn, setDueOn] = useState(task?.dueOn ?? "");
  const [repeat, setRepeat] = useState<string>(task?.repeat ?? "none");
  const [error, setError] = useState("");
  const label = "text-xs font-normal text-muted-foreground";

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
        onSubmit(parsed.data);
        if (!task) { setTitle(""); setAssignee(""); setDueOn(""); setRepeat("none"); }
        setError("");
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9.5rem_9.5rem_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-title`} className={label}>{task ? "Task" : "New task"}</Label>
          <Input id={`${uid}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" aria-label={task ? `Edit task for ${project.name}` : `New task for ${project.name}`} className="h-9" maxLength={160} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-who`} className={label}>Assignee</Label>
          <Input id={`${uid}-who`} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Optional" className="h-9" maxLength={80} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-due`} className={label}>Due date</Label>
          <Input id={`${uid}-due`} type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-repeat`} className={label}>Repeats</Label>
          <Select value={repeat} onValueChange={setRepeat}>
            <SelectTrigger id={`${uid}-repeat`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_REPEATS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="outline" className="h-9">{task ? "Save" : <><Plus /> Add</>}</Button>
          {onCancel && <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onCancel}>Cancel</Button>}
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

export function ProjectCard({ project, today, actions, open, onOpenChange }: {
  project: Project;
  today: string;
  actions: ProjectActions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const health = projectHealth(project, today);
  const { done, total, percent } = progress(project);
  const overdue = project.status === "completed" ? 0 : overdueTasks(project, today).length;
  const finishable = project.status !== "completed" && allTasksDone(project);
  const panelId = `proj-tasks-${project.id}`;
  // The status menu already says "Completed", "On hold" or "Planning"; only show health when it adds something.
  const showHealth = health !== project.status;

  return (
    <li id={`project-${project.id}`} className={cn("scroll-mt-20 rounded-2xl border border-l-4 border-l-transparent bg-card shadow-panel", BORDER[health])} data-testid="project-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold">{project.name}</h3>
            {showHealth && <Badge variant={HEALTH_BADGE[health]}>{HEALTH_LABEL[health]}</Badge>}
            {overdue > 0 && <Badge variant="danger">{overdue} overdue</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {[project.client, project.owner && `Owner: ${project.owner}`, `${formatDayLong(project.startOn)} to ${formatDayLong(project.dueOn)}`].filter(Boolean).join(" · ")}
          </p>
          {project.linked && linkHref(project) && (
            <p className="text-sm" data-testid="project-link">
              For {project.linked.kind === "vendor" ? "vendor" : "contact"}{" "}
              <Link href={linkHref(project)!} className="font-medium text-primary underline-offset-2 hover:underline">{project.linked.name}</Link>
            </p>
          )}
          {project.description && <p className="text-sm">{project.description}</p>}
          <div className="flex items-center gap-3">
            <Progress value={percent} className="max-w-xs" aria-label={`${project.name} progress`} />
            <span className="text-xs text-muted-foreground">{done} of {total} tasks · {percent}%</span>
          </div>
          {finishable && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden /> All tasks are done.
              <Button size="sm" variant="outline" className="h-7" onClick={() => actions.onStatus(project, "completed")}>Mark project complete</Button>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <div className="w-36">
            <Select value={project.status} onValueChange={(v) => actions.onStatus(project, v as ProjectStatus)}>
              <SelectTrigger aria-label={`Status of ${project.name}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{STATUS_LABEL[s.value]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${project.name}`} title="More actions"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => actions.onEdit(project)}><Pencil /> Edit project</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onReport(project)}><Download /> Download report</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => actions.onDelete(project)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-t">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-muted/50"
        >
          <span>Tasks <span className="font-normal text-muted-foreground">{total === 0 ? "none yet" : `${total - done} open`}</span></span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div id={panelId} className="space-y-3 px-4 pb-4">
            {project.tasks.length > 0 && (
              <ul className="space-y-1">
                {sortTasks(project.tasks).map((t) => {
                  if (editing === t.id) {
                    return (
                      <li key={t.id} className="rounded-lg bg-muted/40 p-2">
                        <TaskForm
                          project={project}
                          task={t}
                          onCancel={() => setEditing(null)}
                          onSubmit={(values) => { actions.onEditTask(project, t, values); setEditing(null); }}
                        />
                      </li>
                    );
                  }
                  const state = taskState(t, today);
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-1 py-1 hover:bg-muted/50">
                      <label className="flex min-w-0 flex-1 basis-48 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => actions.onToggleTask(project, t)}
                          className="size-4 shrink-0 rounded border-input accent-primary"
                        />
                        <span className={cn("break-words", t.done && "text-muted-foreground line-through")}>
                          {t.title}
                          {t.dueOn && <span className="sr-only">, {dueText(t, today)}</span>}
                        </span>
                        {t.repeat !== "none" && <Repeat role="img" className="size-3.5 shrink-0 text-muted-foreground" aria-label={`Repeats ${t.repeat}`} />}
                      </label>
                      {t.assignee && <span className="text-xs text-muted-foreground">{t.assignee}</span>}
                      {t.dueOn && <Badge variant={TASK_BADGE[state] ?? "muted"} aria-hidden>{dueText(t, today)}</Badge>}
                      {!t.done && <RemindMenu kind="task" id={t.id} text={`${t.title} · ${project.name}`} area="Tasks" href="/app/projects" today={today} />}
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit task ${t.title}`} title="Edit task" onClick={() => setEditing(t.id)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove task ${t.title}`} title="Remove task" onClick={() => actions.onRemoveTask(project, t)}><X /></Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <TaskForm project={project} onSubmit={(values) => actions.onAddTask(project, values)} />
            {!isRecurringProject(project) && <MilestonesAndUpdates project={project} today={today} actions={actions} />}
          </div>
        )}
      </div>
    </li>
  );
}
