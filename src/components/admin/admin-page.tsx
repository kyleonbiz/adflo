"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarPlus, CheckCircle2, Clock, Hourglass, Inbox, Play, Plus, Repeat, Search, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { downloadText } from "@/components/import/csv-source";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayLong } from "@/lib/dates";
import { toIcs } from "@/lib/admin/ics";
import {
  EVERY_TEXT, calendarEvents, createRequest, decide, dueRoutines, dueText, isOverdue, notifications, runRoutines, setStatus, summarize,
  type NewRequest,
} from "@/lib/admin/logic";
import { sampleRequests, sampleRoutines } from "@/lib/admin/sample-data";
import { CATEGORIES, type AdminRequest, type Category, type RequestStatus, type Routine } from "@/lib/admin/types";
import { useSetupConfig } from "@/lib/setup/storage";
import { installedRoutines } from "@/lib/setup/templates";
import { PRIORITY_BADGE, STATUS_BADGE, STATUS_LABEL } from "./status";
import { RequestDialog } from "./request-dialog";
import { RoutineDialog } from "./routine-dialog";

const rid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const APPROVER = "Operations manager";

function RequestCard({
  r, today, onStatus, onDecide, onDelete,
}: {
  r: AdminRequest; today: string;
  onStatus: (r: AdminRequest, s: RequestStatus) => void;
  onDecide: (r: AdminRequest, d: "approved" | "declined", comment: string) => void;
  onDelete: (r: AdminRequest) => void;
}) {
  const [comment, setComment] = useState("");
  const overdue = isOverdue(r, today);
  return (
    <li className="space-y-2 rounded-2xl border bg-card p-4 shadow-panel" data-testid="request-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{r.title}</h3>
            <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
            <Badge variant="muted">{r.category}</Badge>
            {r.priority !== "normal" && <Badge variant={PRIORITY_BADGE[r.priority]}>{r.priority === "high" ? "High priority" : "Low priority"}</Badge>}
            {r.source !== "manual" && <Badge variant="outline">{r.source === "email" ? "From email" : "Recurring"}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {r.requester && `${r.requester} · `}
            {r.dueOn ? <span className={overdue ? "font-medium text-destructive" : undefined}>Due {r.status === "done" || r.status === "declined" ? formatDayLong(r.dueOn) : dueText(r.dueOn, today)}</span> : "No due date"}
          </p>
          {r.description && <p className="whitespace-pre-wrap text-sm">{r.description}</p>}
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.title}`} onClick={() => onDelete(r)}><Trash2 /></Button>
      </div>

      {r.approvalReasons.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-800"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Needs approval: {r.approvalReasons.join("; ")}.</p>
      )}
      {r.decidedBy && r.decidedOn && (
        <p className="text-xs text-muted-foreground">{r.status === "declined" ? "Declined" : "Approved"} by {r.decidedBy} on {formatDayLong(r.decidedOn)}{r.comment && `: ${r.comment}`}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {r.status === "pending_approval" && (
          <>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" aria-label={`Comment on ${r.title}`} className="h-8 w-48 text-xs" maxLength={200} />
            <Button size="sm" variant="outline" aria-label={`Approve ${r.title}`} onClick={() => onDecide(r, "approved", comment)}><CheckCircle2 /> Approve</Button>
            <Button size="sm" variant="outline" aria-label={`Decline ${r.title}`} onClick={() => onDecide(r, "declined", comment)}><XCircle /> Decline</Button>
          </>
        )}
        {r.status === "open" && <Button size="sm" variant="outline" aria-label={`Start ${r.title}`} onClick={() => onStatus(r, "in_progress")}><Play /> Start</Button>}
        {(r.status === "open" || r.status === "in_progress") && <Button size="sm" variant="outline" aria-label={`Mark ${r.title} done`} onClick={() => onStatus(r, "done")}><CheckCircle2 /> Done</Button>}
        {r.status === "in_progress" && <Button size="sm" variant="ghost" aria-label={`Move ${r.title} back to open`} onClick={() => onStatus(r, "open")}>Back to open</Button>}
        {r.status === "done" && <Button size="sm" variant="ghost" aria-label={`Reopen ${r.title}`} onClick={() => onStatus(r, "open")}>Reopen</Button>}
      </div>
    </li>
  );
}

/**
 * Admin Support. Requests and recurring tasks live in this component's state (seeded with sample
 * data) until the database is connected. Categories and approval flags come from fixed keyword rules,
 * not an AI service, and the digest is shown on screen rather than emailed.
 */
export function AdminPage({ preview, startNew }: { preview?: string; startNew?: boolean }) {
  const today = useToday();
  const [editedRequests, setEditedRequests] = useState<AdminRequest[] | null>(null);
  const [editedRoutines, setEditedRoutines] = useState<Routine[] | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | RequestStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [requesting, setRequesting] = useState(!!startNew);
  const [addingRoutine, setAddingRoutine] = useState(false);
  const [deleting, setDeleting] = useState<AdminRequest | null>(null);
  const [notice, setNotice] = useState("");

  const requests = useMemo(() => editedRequests ?? (today ? sampleRequests(today) : []), [editedRequests, today]);
  const setup = useSetupConfig();
  // Recurring tasks installed by Back Office Setup (only once setup is finished) sit after the samples.
  const routines = useMemo(
    () => editedRoutines ?? (today ? [...sampleRoutines(today), ...installedRoutines(setup?.completedOn ? setup.templates : [], today)] : []),
    [editedRoutines, today, setup],
  );

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const patch = (id: string, change: (r: AdminRequest) => AdminRequest) => setEditedRequests(requests.map((r) => (r.id === id ? change(r) : r)));
  const summary = summarize(requests, routines, today);
  const digest = notifications(requests, routines, today);
  const q = query.trim().toLowerCase();
  const visible = requests
    .filter((r) => statusFilter === "all" || (statusFilter === "active" ? r.status === "open" || r.status === "in_progress" : r.status === statusFilter))
    .filter((r) => categoryFilter === "all" || r.category === categoryFilter)
    .filter((r) => !q || [r.title, r.description, r.requester].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => Number(["done", "declined"].includes(a.status)) - Number(["done", "declined"].includes(b.status)) || (a.dueOn ?? "9999") .localeCompare(b.dueOn ?? "9999"));

  const create = (input: NewRequest) => {
    const r = createRequest(input, today, rid("r"));
    setEditedRequests([r, ...requests]);
    setNotice(r.status === "pending_approval" ? `"${r.title}" needs approval before work starts.` : `"${r.title}" created.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Support</h1>
          <p className="text-sm text-muted-foreground">One inbox for requests, recurring tasks and reminders, with approval for anything risky.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadText(toIcs(calendarEvents(requests, routines), today), `admin-calendar-${today}.ics`, "text/calendar")}><CalendarPlus /> Add to calendar</Button>
          <Button onClick={() => setRequesting(true)}><Plus /> New request</Button>
        </div>
      </div>

      {preview && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={Inbox} label="Open requests" value={summary.open} tone="text-primary" />
        <SummaryTile icon={Hourglass} label="Awaiting approval" value={summary.pendingApproval} tone="text-amber-600" />
        <SummaryTile icon={Clock} label="Overdue" value={summary.overdue} tone="text-red-600" />
        <SummaryTile icon={Repeat} label="Recurring due" value={summary.routinesDue} tone="text-sky-600" />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="digest-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="digest-heading" className="flex items-center gap-2 text-base font-semibold"><Bell className="size-4 text-primary" aria-hidden /> Today&apos;s digest</h2>
          {digest.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing needs attention today.</p>
          ) : (
            <ul className="mt-2 space-y-1.5" data-testid="digest">
              {digest.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <Badge variant={n.severity === "critical" ? "danger" : n.severity === "warning" ? "warning" : "default"} className="mt-0.5 shrink-0">{n.severity === "critical" ? "Overdue" : n.severity === "warning" ? "Soon" : "FYI"}</Badge>
                  <span>{n.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Shown here only. It is not emailed until email sending is connected.</p>
        </section>

        <section aria-labelledby="routines-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="routines-heading" className="flex items-center gap-2 text-base font-semibold"><Repeat className="size-4 text-primary" aria-hidden /> Recurring tasks</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={dueRoutines(routines, today).length === 0}
                onClick={() => {
                  let n = 0;
                  const result = runRoutines(routines, today, () => `r-${Math.random().toString(36).slice(2, 10)}-${++n}`);
                  setEditedRoutines(result.routines);
                  setEditedRequests([...result.created, ...requests]);
                  setNotice(`Created ${result.created.length} request${result.created.length === 1 ? "" : "s"} from recurring tasks.`);
                }}
              >
                <Play /> Create due requests
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingRoutine(true)}><Plus /> Add</Button>
            </div>
          </div>
          {routines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No recurring tasks yet.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {routines.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm" data-testid="routine-row">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{EVERY_TEXT[r.every]} · next {dueText(r.nextDueOn, today)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {r.nextDueOn <= today && <Badge variant="warning">Due</Badge>}
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete recurring task ${r.title}`} onClick={() => setEditedRoutines(routines.filter((x) => x.id !== r.id))}><Trash2 /></Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="Requests" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests" aria-label="Search requests" className="pl-9" />
          </div>
          <div className="sm:w-48">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Open or in progress</SelectItem>
                {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-52">
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
              <SelectTrigger aria-label="Filter by category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {requests.length === 0 ? "No requests yet. Create the first one." : "No requests match these filters."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((r) => (
              <RequestCard
                key={r.id} r={r} today={today}
                onStatus={(x, s) => { patch(x.id, (y) => setStatus(y, s, today)); setNotice(`"${x.title}" is now ${STATUS_LABEL[s].toLowerCase()}.`); }}
                onDecide={(x, d, c) => { patch(x.id, (y) => decide(y, d, APPROVER, today, c)); setNotice(`"${x.title}" ${d}.`); }}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        )}
      </section>

      <RequestDialog open={requesting} onOpenChange={setRequesting} onSave={create} />
      <RoutineDialog
        open={addingRoutine}
        today={today}
        onOpenChange={setAddingRoutine}
        onSave={(r) => { setEditedRoutines([...routines, { ...r, id: rid("t") }]); setNotice(`Recurring task "${r.title}" added.`); }}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete request?</DialogTitle>
          <DialogDescription className="mt-1">&quot;{deleting?.title}&quot; will be removed.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleting) { setEditedRequests(requests.filter((r) => r.id !== deleting.id)); setNotice(`"${deleting.title}" deleted.`); } setDeleting(null); }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
