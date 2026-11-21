"use client";

import { useId, useMemo, useState } from "react";
import { FolderKanban, Pencil, Plus, Repeat, X } from "lucide-react";
import { RemindMenu } from "@/components/modules/remind-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BulkBar, SelectBox, useSelection } from "@/components/ui/bulk-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { daysBetween } from "@/lib/dates";
import { isGeneral, taskList, type TaskItem } from "@/lib/projects/logic";
import { TASK_REPEATS, type Project } from "@/lib/projects/types";
import { taskFormSchema, type TaskFormValues } from "@/lib/projects/validation";
import { cn } from "@/lib/utils";
import { TaskForm, dueText, type ProjectActions } from "./project-card";
import { TASK_BADGE } from "./status";

export type TaskFilter = "all" | "overdue" | "week" | "repeating";
const TASK_FILTER_LABEL: Record<TaskFilter, string> = { all: "All tasks", overdue: "Overdue", week: "Due this week", repeating: "Repeating" };
const NO_PROJECT = "none";

/** Adds a task, optionally to a project; without one it goes to the built-in "General tasks". */
function QuickAdd({ projects, onAdd }: { projects: Project[]; onAdd: (values: TaskFormValues, projectId: string | null) => void }) {
  const uid = useId();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [repeat, setRepeat] = useState<string>("none");
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [error, setError] = useState("");
  const label = "text-xs font-normal text-muted-foreground";
  const choices = projects.filter((p) => !isGeneral(p) && p.status !== "completed");

  return (
    <form
      noValidate
      aria-label="Add a task"
      className="space-y-2 rounded-2xl border bg-card p-4 shadow-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = taskFormSchema.safeParse({ title, assignee, dueOn, repeat });
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        onAdd(parsed.data, projectId === NO_PROJECT ? null : projectId);
        setTitle(""); setAssignee(""); setDueOn(""); setRepeat("none"); setError("");
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_9.5rem_9.5rem_11rem_auto] lg:items-end">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label htmlFor={`${uid}-title`} className={label}>New task</Label>
          <Input id={`${uid}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" className="h-9" maxLength={160} />
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
        <div className="space-y-1">
          <Label htmlFor={`${uid}-project`} className={label}>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id={`${uid}-project`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PROJECT}>No project</SelectItem>
              {choices.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="h-9 sm:col-span-2 lg:col-span-1"><Plus /> Add task</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function matches(item: TaskItem, filter: TaskFilter, query: string, today: string): boolean {
  const { task, project, state } = item;
  if (query && ![task.title, task.assignee, isGeneral(project) ? "" : project.name].some((f) => f.toLowerCase().includes(query))) return false;
  if (filter === "overdue") return state === "overdue";
  if (filter === "week") return !task.done && !!task.dueOn && daysBetween(today, task.dueOn) <= 7;
  if (filter === "repeating") return task.repeat !== "none";
  return true;
}

/** The flat list of every task, most urgent first, with a quick-add form on top. */
export function TasksView({ projects, today, query, filter, onFilter, showDone, onShowDone, actions, onAdd, onOpenProject }: {
  projects: Project[];
  today: string;
  /** Lower-cased search text. */
  query: string;
  filter: TaskFilter;
  onFilter: (f: TaskFilter) => void;
  showDone: boolean;
  onShowDone: (v: boolean) => void;
  actions: ProjectActions;
  onAdd: (values: TaskFormValues, projectId: string | null) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [who, setWho] = useState("all");
  const sel = useSelection();
  const all = useMemo(() => taskList(projects, today, showDone), [projects, today, showDone]);
  const assignees = useMemo(() => [...new Set(all.map((i) => i.task.assignee.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [all]);
  const items = useMemo(() => all.filter((i) => matches(i, filter, query, today)).filter((i) => who === "all" || (who === "none" ? !i.task.assignee.trim() : i.task.assignee.trim() === who)), [all, filter, query, today, who]);
  const filtered = filter !== "all" || query !== "" || who !== "all";
  const loose = items.filter((i) => isGeneral(i.project));
  const groups = useMemo(() => {
    const map = new Map<string, { project: Project; items: TaskItem[] }>();
    for (const i of items) {
      if (isGeneral(i.project)) continue;
      const g = map.get(i.project.id) ?? { project: i.project, items: [] };
      g.items.push(i);
      map.set(i.project.id, g);
    }
    return [...map.values()];
  }, [items]);

  const renderRow = ({ project, task, state }: TaskItem) => {
    if (editing === task.id) {
      return (
        <li key={task.id} className="py-2">
          <TaskForm project={project} task={task} onCancel={() => setEditing(null)} onSubmit={(v) => { actions.onEditTask(project, task, v); setEditing(null); }} />
        </li>
      );
    }
    return (
      <li
        key={task.id}
        data-testid="task-row"
        onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button,input,label,[role=menu]")) setEditing(task.id); }}
        className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 py-2 hover:bg-muted/30"
      >
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-2 text-sm">
          <SelectBox checked={sel.has(task.id)} onChange={() => sel.toggle(task.id)} label={`Select task ${task.title}`} />
          <input type="checkbox" aria-labelledby={`task-title-${task.id}`} checked={task.done} onChange={() => actions.onToggleTask(project, task)} className="size-4 shrink-0 cursor-pointer rounded border-input accent-primary" />
          <span id={`task-title-${task.id}`} className={cn("break-words", task.done && "text-muted-foreground line-through")}>
            {task.title}
            {task.dueOn && <span className="sr-only">, {dueText(task, today)}</span>}
          </span>
          {task.repeat !== "none" && <Repeat role="img" className="size-3.5 shrink-0 text-muted-foreground" aria-label={`Repeats ${task.repeat}`} />}
        </div>
        {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee}</span>}
        {task.dueOn && <Badge variant={TASK_BADGE[state] ?? "muted"} aria-hidden>{dueText(task, today)}</Badge>}
        {!task.done && <RemindMenu kind="task" id={task.id} text={isGeneral(project) ? task.title : `${task.title} · ${project.name}`} area="Tasks" href="/app/projects" today={today} />}
        <Button size="icon-sm" variant="ghost" aria-label={`Edit task ${task.title}`} title="Edit task" onClick={() => setEditing(task.id)}><Pencil /></Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Remove task ${task.title}`} title="Remove task" onClick={() => actions.onRemoveTask(project, task)}><X /></Button>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <QuickAdd projects={projects} onAdd={onAdd} />

      <section aria-labelledby="task-list-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="task-list-heading" className="text-base font-semibold">
            {filtered ? `Tasks (${items.length} of ${all.length})` : `Tasks (${all.length})`}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={showDone} onChange={(e) => onShowDone(e.target.checked)} className="size-4 rounded border-input accent-primary" />
              Show completed
            </label>
            {assignees.length > 0 && (
              <div className="w-40">
                <Select value={who} onValueChange={setWho}>
                  <SelectTrigger aria-label="Filter tasks by assignee"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    {assignees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    <SelectItem value="none">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-44">
              <Select value={filter} onValueChange={(v) => onFilter(v as TaskFilter)}>
                <SelectTrigger aria-label="Filter tasks"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_FILTER_LABEL) as TaskFilter[]).map((k) => <SelectItem key={k} value={k}>{TASK_FILTER_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <BulkBar count={sel.size} total={items.length} noun="tasks selected" onSelectAll={() => sel.set(items.map((i) => i.task.id))} onClear={sel.clear}>
          <Button size="sm" variant="outline" onClick={() => { actions.onBulkTasks(items.filter((i) => sel.has(i.task.id) && !i.task.done).map((i) => ({ project: i.project, task: i.task })), "done"); sel.clear(); }}>Mark done</Button>
          <Button size="sm" variant="destructive" onClick={() => { actions.onBulkTasks(items.filter((i) => sel.has(i.task.id)).map((i) => ({ project: i.project, task: i.task })), "remove"); sel.clear(); }}>Remove</Button>
        </BulkBar>

        {items.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            <p>{all.length === 0 ? "No tasks yet. Add your first one above." : "No tasks match these filters."}</p>
            {all.length > 0 && filtered && <Button variant="outline" onClick={() => { onFilter("all"); setWho("all"); }}>Clear filter</Button>}
          </div>
        ) : (
          <div className="space-y-4">
            {loose.length > 0 && <ul className="divide-y rounded-2xl border bg-card px-3 shadow-panel" data-testid="task-list">{loose.map(renderRow)}</ul>}
            {groups.map(({ project, items: rows }) => (
              <section key={project.id} aria-label={`Project: ${project.name}`} data-testid="project-group" className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] p-3 shadow-panel">
                <div className="mb-1 flex flex-wrap items-center gap-2 px-1">
                  <Badge variant="default"><FolderKanban className="size-3" aria-hidden /> Project</Badge>
                  <button type="button" onClick={() => onOpenProject(project.id)} className="rounded text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{project.name}</button>
                  <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "task" : "tasks"}</span>
                </div>
                <ul className="divide-y rounded-xl bg-card px-3">{rows.map(renderRow)}</ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
