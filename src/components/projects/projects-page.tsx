"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FolderKanban, ListTodo, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { completeTask, overdueTasks, projectsReport, reopenTask, sortProjects, summarize, taskAlerts, type ProjectSort } from "@/lib/projects/logic";
import { e2eSeed } from "@/lib/e2e-seed";
import { buildTasks, type TemplateTask } from "@/lib/projects/templates";
import { PROJECT_STATUSES, type Project, type ProjectStatus, type Task } from "@/lib/projects/types";
import type { ProjectFormValues, TaskFormValues } from "@/lib/projects/validation";
import { ProjectCard, type ProjectActions } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { STATUS_LABEL, TASK_BADGE } from "./status";
import { titleCase } from "@/lib/text";

const rid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  // Some browsers cancel the download if the URL is revoked straight away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SORT_LABEL: Record<ProjectSort, string> = { due: "Due date", health: "Needs attention first", name: "Name" };
/** Attention rows shown before "Show all". */
const ATTENTION_LIMIT = 6;
/** Projects with overdue tasks open on arrival, up to this many, so the work is visible without a click. */
const AUTO_OPEN = 2;

interface Notice { n: number; text: string; undo?: () => void }

const isLive = (p: Project) => p.status !== "completed" && p.status !== "on_hold";

/**
 * Project administration. Projects and tasks live in this component's state (starting empty)
 * until the database is connected, so nothing here is saved between visits and no notifications are sent.
 */
export function ProjectsPage({ preview, initialQuery = "" }: { preview?: string; initialQuery?: string }) {
  const today = useToday();
  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }
  return <ProjectsView today={today} preview={preview} initialQuery={initialQuery} />;
}

function ProjectsView({ today, preview, initialQuery }: { today: string; preview?: string; initialQuery: string }) {
  const [projects, setProjects] = useState<Project[]>(() => e2eSeed<Project>("projects") ?? []);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      (e2eSeed<Project>("projects") ?? []).filter((p) => isLive(p) && overdueTasks(p, today).length > 0).slice(0, AUTO_OPEN).map((p) => [p.id, true]),
    ),
  );
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState<ProjectSort>("due");
  const [formFor, setFormFor] = useState<Project | "new" | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [completing, setCompleting] = useState<Project | null>(null);
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  const setNotice = (text: string, undo?: () => void) => setNoticeState((prev) => ({ n: (prev?.n ?? 0) + 1, text, undo }));

  // Action results stay visible long enough to read (and undo), then clear.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNoticeState(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (focus) document.getElementById(`project-${focus.id}`)?.scrollIntoView({ block: "center" });
  }, [focus]);

  const patch = (id: string, change: (p: Project) => Project) => setProjects((all) => all.map((p) => (p.id === id ? change(p) : p)));
  const restoreAt = <T extends { id: string }>(list: T[], item: T, index: number) =>
    list.some((x) => x.id === item.id) ? list : [...list.slice(0, index), item, ...list.slice(index)];

  const applyStatus = (p: Project, status: ProjectStatus, finishTasks = false) => {
    patch(p.id, (x) => ({
      ...x,
      status,
      tasks: finishTasks ? x.tasks.map((t) => (t.done ? t : { ...t, done: true, doneOn: today })) : x.tasks,
    }));
    setNotice(`${p.name} is now ${STATUS_LABEL[status].toLowerCase()}.`);
  };

  const actions: ProjectActions = {
    onEdit: (p) => setFormFor(p),
    onDelete: (p) => setDeleting(p),
    onStatus: (p, status) => {
      if (status === p.status) return;
      if (status === "completed" && p.tasks.some((t) => !t.done)) setCompleting(p);
      else applyStatus(p, status);
    },
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
    onAddTask: (p, v: TaskFormValues) => {
      patch(p.id, (x) => ({
        ...x,
        tasks: [...x.tasks, {
          id: rid("t"), title: v.title, assignee: v.assignee, dueOn: v.dueOn || null,
          repeat: v.repeat as Task["repeat"], done: false, doneOn: null, followUpId: null,
        }],
      }));
      setNotice(`"${v.title}" added to ${p.name}.`);
    },
    onEditTask: (p, t, v) => {
      patch(p.id, (x) => ({
        ...x,
        tasks: x.tasks.map((y) =>
          y.id === t.id ? { ...y, title: v.title, assignee: v.assignee, dueOn: v.dueOn || null, repeat: v.repeat as Task["repeat"], anchorDay: undefined } : y,
        ),
      }));
      setNotice(`"${v.title}" updated.`);
    },
    onRemoveTask: (p, t) => {
      const index = p.tasks.findIndex((y) => y.id === t.id);
      patch(p.id, (x) => ({ ...x, tasks: x.tasks.filter((y) => y.id !== t.id) }));
      setNotice(`"${t.title}" removed.`, () => patch(p.id, (x) => ({ ...x, tasks: restoreAt(x.tasks, t, index) })));
    },
  };

  const saveForm = (values: ProjectFormValues, templateTasks: TemplateTask[]) => {
    const status = values.status as ProjectStatus;
    if (formFor && formFor !== "new") {
      patch(formFor.id, (x) => ({ ...x, ...values, status }));
      setNotice(`${values.name} updated.`);
    } else {
      const id = rid("p");
      const tasks = buildTasks(templateTasks, values.startOn, () => rid("t"));
      setProjects((all) => [...all, { ...values, status, id, tasks }]);
      if (tasks.length > 0) setOpen((o) => ({ ...o, [id]: true }));
      setNotice(tasks.length > 0 ? `${values.name} created with ${plural(tasks.length, "task")}.` : `${values.name} created.`);
    }
  };

  const deleteProject = (p: Project) => {
    const index = projects.findIndex((x) => x.id === p.id);
    setProjects((all) => all.filter((x) => x.id !== p.id));
    setNotice(`${p.name} deleted.`, () => setProjects((all) => restoreAt(all, p, index)));
  };

  const summary = useMemo(() => summarize(projects, today), [projects, today]);
  const alerts = useMemo(() => taskAlerts(projects, today), [projects, today]);
  const q = query.trim().toLowerCase();
  const filtered = statusFilter !== "all" || overdueOnly || q !== "";
  const clearFilters = () => { setQuery(""); setStatusFilter("all"); setOverdueOnly(false); };
  const visible = useMemo(
    () =>
      sortProjects(projects, sort, today)
        .filter((p) => statusFilter === "all" || p.status === statusFilter)
        .filter((p) => !overdueOnly || (isLive(p) && overdueTasks(p, today).length > 0))
        .filter((p) => !q || [p.name, p.client, p.description].some((f) => f.toLowerCase().includes(q))),
    [projects, sort, today, statusFilter, overdueOnly, q],
  );

  const showProject = (id: string) => {
    // The card might be filtered out; clear filters so it can be found, then open its tasks.
    clearFilters();
    setOpen((o) => ({ ...o, [id]: true }));
    setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  };

  const shownAlerts = showAllAlerts ? alerts : alerts.slice(0, ATTENTION_LIMIT);
  const openTaskCount = (p: Project) => p.tasks.filter((t) => !t.done).length;

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
            title={filtered ? "Only the projects matching your filters are included" : undefined}
          >
            <Download /> {filtered ? `Report for ${plural(visible.length, "project")}` : "Status report"}
          </Button>
          <Button onClick={() => setFormFor("new")}><Plus /> New project</Button>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <div role="status" aria-live="polite" className={notice ? "sticky top-2 z-20 flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm shadow-float" : "sr-only"}>
        <span key={notice?.n}>{notice?.text}</span>
        {notice && (
          <span className="flex shrink-0 items-center gap-3">
            {notice.undo && (
              <button
                type="button"
                onClick={() => { notice.undo?.(); setNoticeState(null); }}
                className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Undo
              </button>
            )}
            <button type="button" aria-label="Dismiss message" onClick={() => setNoticeState(null)} className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-4" aria-hidden />
            </button>
          </span>
        )}
      </div>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={FolderKanban} label="Active projects" value={summary.activeProjects} tone="text-primary" pressed={statusFilter === "active"}
          onClick={() => { setOverdueOnly(false); setStatusFilter("active"); }} />
        <SummaryTile icon={ListTodo} label="Open tasks" value={summary.openTasks} tone="text-sky-600" onClick={clearFilters} />
        <SummaryTile icon={AlertTriangle} label="Overdue tasks" value={summary.overdueTasks} tone="text-red-600" pressed={overdueOnly}
          onClick={() => { setStatusFilter("all"); setOverdueOnly(true); }} />
        <SummaryTile icon={CheckCircle2} label="Done this month" value={summary.completedThisMonth} tone="text-emerald-600" />
      </section>

      <section aria-labelledby="slipping-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h2 id="slipping-heading" className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="size-4 text-amber-600" aria-hidden /> Needs attention</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No overdue tasks and nothing due in the next three days.</p>
        ) : (
          <>
            <ul className="mt-2 divide-y">
              {shownAlerts.map((a) => {
                const project = projects.find((p) => p.id === a.projectId);
                return (
                  <li key={a.task.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{a.task.title}</span>{" "}
                      <span className="text-muted-foreground">
                        · <button type="button" onClick={() => showProject(a.projectId)} className="rounded underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{a.projectName}</button>
                        {a.task.assignee && ` · ${a.task.assignee}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant={TASK_BADGE[a.state]}>
                        {a.state === "overdue" ? `${-a.daysLeft} day${a.daysLeft === -1 ? "" : "s"} overdue` : a.state === "due_today" ? "due today" : `due ${formatDayLong(a.task.dueOn!)}`}
                      </Badge>
                      {project && (
                        <Button size="sm" variant="outline" className="h-7" aria-label={`Mark ${a.task.title} done`} onClick={() => actions.onToggleTask(project, a.task)}>
                          <CheckCircle2 /> Done
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {alerts.length > ATTENTION_LIMIT && (
              <button type="button" onClick={() => setShowAllAlerts((v) => !v)} className="mt-2 rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {showAllAlerts ? "Show fewer" : `Show all ${alerts.length}`}
              </button>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="all-projects-heading" className="space-y-3">
        <h2 id="all-projects-heading" className="text-base font-semibold">
          {filtered ? `Projects (${visible.length} of ${projects.length})` : `Projects (${projects.length})`}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, client or description" aria-label="Search projects" className="px-9" />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="sm:w-56">
            <Select value={sort} onValueChange={(v) => setSort(v as ProjectSort)}>
              <SelectTrigger aria-label="Sort projects"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as ProjectSort[]).map((k) => <SelectItem key={k} value={k}>Sort: {titleCase(SORT_LABEL[k])}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-52">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{titleCase(s.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {overdueOnly && (
          <p className="text-sm text-muted-foreground">Showing projects with overdue tasks. <button type="button" onClick={() => setOverdueOnly(false)} className="font-medium text-primary underline-offset-2 hover:underline">Show all</button></p>
        )}

        {visible.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            <p>{projects.length === 0 ? "No projects yet." : "No projects match these filters."}</p>
            {projects.length === 0 ? <Button onClick={() => setFormFor("new")}><Plus /> Create your first project</Button>
              : filtered && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                today={today}
                actions={actions}
                open={!!open[p.id]}
                onOpenChange={(o) => setOpen((prev) => ({ ...prev, [p.id]: o }))}
              />
            ))}
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
          <DialogDescription className="mt-1">
            {deleting?.name}{deleting && deleting.tasks.length > 0 ? ` and its ${plural(deleting.tasks.length, "task")} will be removed.` : " will be removed."} You can undo this right after.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteProject(deleting);
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Complete project?</DialogTitle>
          <DialogDescription className="mt-1">
            {completing?.name} still has {completing ? plural(openTaskCount(completing), "open task") : ""}.
          </DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setCompleting(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => { if (completing) applyStatus(completing, "completed"); setCompleting(null); }}>Keep tasks open</Button>
            <Button onClick={() => { if (completing) applyStatus(completing, "completed", true); setCompleting(null); }}>Mark tasks done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
