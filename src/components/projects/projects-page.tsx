"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FolderKanban, ListTodo, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { completeTask, projectsReport, reopenTask, summarize, taskAlerts } from "@/lib/projects/logic";
import { sampleProjects } from "@/lib/projects/sample-data";
import { PROJECT_STATUSES, type Project, type ProjectStatus, type Task } from "@/lib/projects/types";
import type { ProjectFormValues, TaskFormValues } from "@/lib/projects/validation";
import { ProjectCard, type ProjectActions } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { STATUS_LABEL, TASK_BADGE } from "./status";

const rid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";

/**
 * Project administration. Projects and tasks live in this component's state (seeded with sample data)
 * until the database is connected, so nothing here is saved between visits and no notifications are sent.
 */
export function ProjectsPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [edited, setEdited] = useState<Project[] | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [formFor, setFormFor] = useState<Project | "new" | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [notice, setNotice] = useState("");

  const projects = useMemo(() => edited ?? (today ? sampleProjects(today) : []), [edited, today]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const update = (fn: (all: Project[]) => Project[]) => setEdited(fn(projects));
  const patch = (id: string, change: (p: Project) => Project) => update((all) => all.map((p) => (p.id === id ? change(p) : p)));

  const actions: ProjectActions = {
    onEdit: (p) => setFormFor(p),
    onDelete: (p) => setDeleting(p),
    onStatus: (p, status) => { patch(p.id, (x) => ({ ...x, status })); setNotice(`${p.name} is now ${STATUS_LABEL[status].toLowerCase()}.`); },
    onReport: (p) => downloadText(projectsReport([p], today), `status-${slug(p.name)}-${today}.txt`),
    onToggleTask: (p, t: Task) => {
      if (t.done) {
        patch(p.id, (x) => ({ ...x, tasks: reopenTask(x.tasks, t.id) }));
        setNotice(`"${t.title}" reopened.`);
        return;
      }
      const tasks = completeTask(p.tasks, t.id, today, rid("t"));
      patch(p.id, (x) => ({ ...x, tasks }));
      setNotice(tasks.length > p.tasks.length ? `"${t.title}" done. The next one is scheduled.` : `"${t.title}" done.`);
    },
    onAddTask: (p, v: TaskFormValues) =>
      patch(p.id, (x) => ({
        ...x,
        tasks: [...x.tasks, {
          id: rid("t"), title: v.title, assignee: v.assignee, dueOn: v.dueOn || null,
          repeat: v.repeat as Task["repeat"], done: false, doneOn: null, followUpId: null,
        }],
      })),
    onRemoveTask: (p, t) => patch(p.id, (x) => ({ ...x, tasks: x.tasks.filter((y) => y.id !== t.id) })),
  };

  const saveForm = (values: ProjectFormValues) => {
    const status = values.status as ProjectStatus;
    if (formFor && formFor !== "new") {
      patch(formFor.id, (x) => ({ ...x, ...values, status }));
      setNotice(`${values.name} updated.`);
    } else {
      update((all) => [...all, { ...values, status, id: rid("p"), tasks: [] }]);
      setNotice(`${values.name} created.`);
    }
  };

  const summary = summarize(projects, today);
  const alerts = taskAlerts(projects, today);
  const q = query.trim().toLowerCase();
  const visible = projects
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => !q || [p.name, p.client, p.description].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => {
      const finished = Number(a.status === "completed") - Number(b.status === "completed");
      return finished || (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0);
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Plan projects, assign tasks, repeat routine work and see what is slipping.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadText(projectsReport(visible, today), `status-report-${today}.txt`)}
            disabled={visible.length === 0}
          >
            <Download /> Status report
          </Button>
          <Button onClick={() => setFormFor("new")}><Plus /> New project</Button>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={FolderKanban} label="Active projects" value={summary.activeProjects} tone="text-primary" />
        <SummaryTile icon={ListTodo} label="Open tasks" value={summary.openTasks} tone="text-sky-600" />
        <SummaryTile icon={AlertTriangle} label="Overdue tasks" value={summary.overdueTasks} tone="text-red-600" />
        <SummaryTile icon={CheckCircle2} label="Done this month" value={summary.completedThisMonth} tone="text-emerald-600" />
      </section>

      <section aria-labelledby="slipping-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h2 id="slipping-heading" className="text-base font-semibold">Needs attention</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No overdue tasks and nothing due in the next three days.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {alerts.map((a) => (
              <li key={a.task.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-medium">{a.task.title}</span> <span className="text-muted-foreground">· {a.projectName}{a.task.assignee && ` · ${a.task.assignee}`}</span></span>
                <Badge variant={TASK_BADGE[a.state]}>
                  {a.state === "overdue" ? `${-a.daysLeft} day${a.daysLeft === -1 ? "" : "s"} overdue` : a.state === "due_today" ? "due today" : `due ${formatDayLong(a.task.dueOn!)}`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Projects" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, client or description" aria-label="Search projects" className="pl-9" />
          </div>
          <div className="sm:w-52">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {projects.length === 0 ? "No projects yet. Create your first one." : "No projects match these filters."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => <ProjectCard key={p.id} project={p} today={today} actions={actions} />)}
          </ul>
        )}
      </section>

      <ProjectFormDialog
        open={formFor !== null}
        project={formFor && formFor !== "new" ? formFor : undefined}
        today={today}
        onOpenChange={(o) => !o && setFormFor(null)}
        onSubmit={saveForm}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription className="mt-1">{deleting?.name} and all of its tasks will be removed.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  update((all) => all.filter((p) => p.id !== deleting.id));
                  setNotice(`${deleting.name} deleted.`);
                }
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
