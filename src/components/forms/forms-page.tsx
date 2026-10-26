"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FileInput, Hourglass, Inbox, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { approvalQueue, createSubmission, decide, generateDocument, submissionsToCsv, summarize } from "@/lib/forms/logic";
import { sampleForms, sampleSubmissions } from "@/lib/forms/sample-data";
import type { FormTemplate, Submission } from "@/lib/forms/types";
import { useSetupConfig } from "@/lib/setup/storage";
import { installedForms } from "@/lib/setup/templates";
import type { FormBuilderValues } from "@/lib/forms/validation";
import { FillFormDialog } from "./fill-form-dialog";
import { FormBuilderDialog } from "./form-builder-dialog";
import { FormCard, type FormActions } from "./form-card";

type SortKey = "name" | "pending" | "submissions";
type FilterKey = "all" | "pending" | "approval" | "open";
const SORT_LABEL: Record<SortKey, string> = { name: "Name", pending: "Most awaiting approval", submissions: "Most submissions" };
const FILTER_LABEL: Record<FilterKey, string> = { all: "All forms", pending: "Awaiting approval", approval: "Needs approval", open: "No approval needed" };

const rid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "form";

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Forms & Paperwork. Forms and submissions live in this component's state (seeded with sample data)
 * until the database is connected, so nothing here is saved between visits and no notifications are sent.
 */
export function FormsPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [editedForms, setEditedForms] = useState<FormTemplate[] | null>(null);
  const [editedSubs, setEditedSubs] = useState<Submission[] | null>(null);
  const [query, setQuery] = useState("");
  const [builderFor, setBuilderFor] = useState<FormTemplate | "new" | null>(null);
  const [filling, setFilling] = useState<FormTemplate | null>(null);
  const [deleting, setDeleting] = useState<FormTemplate | null>(null);
  const [deletingSub, setDeletingSub] = useState<{ form: FormTemplate; sub: Submission } | null>(null);
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  const setup = useSetupConfig();
  // Forms installed by Back Office Setup (only once setup is finished) sit after the samples.
  const seedForms = useMemo(() => [...sampleForms(), ...installedForms(setup?.completedOn ? setup.templates : [])], [setup]);
  const seedSubs = useMemo(() => (today ? sampleSubmissions(today) : []), [today]);
  const forms = editedForms ?? seedForms;
  const subs = editedSubs ?? seedSubs;
  const queue = useMemo(() => (today ? approvalQueue(forms, subs, today) : []), [forms, subs, today]);

  // Action results stay visible long enough to read, then clear.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const updateForms = (fn: (all: FormTemplate[]) => FormTemplate[]) => setEditedForms((prev) => fn(prev ?? seedForms));
  const updateSubs = (fn: (all: Submission[]) => Submission[]) => setEditedSubs((prev) => fn(prev ?? seedSubs));

  const actions: FormActions = {
    onFill: (f) => setFilling(f),
    onEdit: (f) => setBuilderFor(f),
    onDelete: (f) => setDeleting(f),
    onDecide: (f, s, decision, comment) => {
      updateSubs((all) => all.map((x) => (x.id === s.id ? decide(x, decision, f.approver || "Approver", today, comment) : x)));
      setNotice(`${f.name}: submission by ${s.submittedBy} ${decision}.`);
    },
    onDocument: (f, s) => download(generateDocument(f, s), `${slug(f.name)}-${slug(s.submittedBy)}-${s.submittedOn}.txt`, "text/plain"),
    onExport: (f, list) => download(submissionsToCsv(f, list), `${slug(f.name)}-submissions-${today}.csv`, "text/csv"),
    onDeleteSubmission: (f, s) => setDeletingSub({ form: f, sub: s }),
  };

  const saveForm = (v: FormBuilderValues) => {
    const fields = v.fields.map((f) => ({ ...f, type: f.type as FormTemplate["fields"][number]["type"] }));
    const next = { name: v.name, description: v.description, fields, requiresApproval: v.requiresApproval, approver: v.requiresApproval ? v.approver : "", documentTemplate: v.documentTemplate };
    if (builderFor && builderFor !== "new") {
      const id = builderFor.id;
      updateForms((all) => all.map((f) => (f.id === id ? { ...f, ...next } : f)));
      setNotice(`${v.name} updated.`);
    } else {
      updateForms((all) => [...all, { ...next, id: rid("form") }]);
      setNotice(`${v.name} created.`);
    }
  };

  const summary = summarize(forms, subs, today);
  const q = query.trim().toLowerCase();
  const filtered = q !== "" || filter !== "all";
  const clearFilters = () => { setQuery(""); setFilter("all"); };
  const showForm = (id: string) => {
    // The card might be filtered out; clear filters so it can be found, then open its submissions.
    clearFilters();
    setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  };
  const count = (id: string, status?: Submission["status"]) => subs.filter((s) => s.formId === id && (!status || s.status === status)).length;
  const visible = forms
    .filter((f) => !q || [f.name, f.description].some((x) => x.toLowerCase().includes(q)))
    .filter((f) => filter === "all" || (filter === "pending" ? count(f.id, "pending") > 0 : filter === "approval" ? f.requiresApproval : !f.requiresApproval))
    .sort((a, b) =>
      sort === "pending" ? count(b.id, "pending") - count(a.id, "pending") || a.name.localeCompare(b.name)
      : sort === "submissions" ? count(b.id) - count(a.id) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms &amp; Paperwork</h1>
          <p className="text-sm text-muted-foreground">Build reusable forms, collect answers, route approvals and generate documents.</p>
        </div>
        <Button onClick={() => setBuilderFor("new")}><Plus /> New form</Button>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <div role="status" aria-live="polite" className={notice ? "sticky top-2 z-20 flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm shadow-float" : "sr-only"}>
        <span>{notice}</span>
        {notice && (
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")} className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={FileInput} label="Forms" value={summary.forms} tone="text-primary" onClick={clearFilters} />
        <SummaryTile icon={Inbox} label="Submissions" value={summary.submissions} tone="text-sky-600" />
        <SummaryTile icon={Hourglass} label="Awaiting approval" value={summary.pending} tone="text-amber-600" pressed={filter === "pending"} onClick={() => { setQuery(""); setFilter("pending"); }} />
        <SummaryTile icon={ClipboardCheck} label="Decided this month" value={summary.decidedThisMonth} tone="text-emerald-600" />
      </section>

      {queue.length > 0 && (
        <section aria-labelledby="forms-queue" className="rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="forms-queue" className="flex items-center gap-2 text-base font-semibold"><Hourglass className="size-4 text-amber-600" aria-hidden /> Waiting for a decision</h2>
          <ul className="mt-2 divide-y">
            {queue.map(({ form, submission, daysWaiting }) => (
              <li key={submission.id}>
                <button
                  type="button"
                  onClick={() => showForm(form.id)}
                  aria-label={`Review ${form.name} from ${submission.submittedBy}`}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span><span className="font-medium">{form.name}</span> <span className="text-muted-foreground">from {submission.submittedBy}</span></span>
                  <span className="text-xs text-muted-foreground">{daysWaiting === 0 ? "Today" : `${daysWaiting} day${daysWaiting === 1 ? "" : "s"} waiting`} · {form.approver || "Approver"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="forms-list-title" className="space-y-3">
        <h2 id="forms-list-title" className="sr-only">Forms</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search forms" aria-label="Search forms" className="px-9" />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="sm:w-56">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger aria-label="Sort forms"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>Sort: {SORT_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-52">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <SelectTrigger aria-label="Filter forms"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FILTER_LABEL) as FilterKey[]).map((k) => <SelectItem key={k} value={k}>{FILTER_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            <p>{forms.length === 0 ? "No forms yet." : "No forms match these filters."}</p>
            {forms.length === 0 ? <Button onClick={() => setBuilderFor("new")}><Plus /> Create your first form</Button>
              : filtered && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((f) => <FormCard key={f.id} form={f} submissions={subs.filter((s) => s.formId === f.id)} actions={actions} focusKey={focus?.id === f.id ? focus.n : undefined} />)}
          </ul>
        )}
      </section>

      <FormBuilderDialog
        open={builderFor !== null}
        form={builderFor && builderFor !== "new" ? builderFor : undefined}
        existing={forms}
        onOpenChange={(o) => !o && setBuilderFor(null)}
        onSave={saveForm}
      />

      <FillFormDialog
        open={filling !== null}
        form={filling}
        onOpenChange={(o) => !o && setFilling(null)}
        onSubmit={(values, by) => {
          if (!filling) return;
          const s = createSubmission(filling, values, by, today, rid("s"));
          updateSubs((all) => [...all, s]);
          setNotice(filling.requiresApproval ? `Submitted. Waiting for ${filling.approver} to approve.` : "Submitted. Thank you.");
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete form?</DialogTitle>
          <DialogDescription className="mt-1">
            {deleting?.name} and {deleting && count(deleting.id) > 0 ? `its ${count(deleting.id)} submission${count(deleting.id) === 1 ? "" : "s"}` : "all of its submissions"} will be removed. Export the submissions first if you need a record.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  updateForms((all) => all.filter((f) => f.id !== deleting.id));
                  updateSubs((all) => all.filter((s) => s.formId !== deleting.id));
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

      <Dialog open={!!deletingSub} onOpenChange={(o) => !o && setDeletingSub(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete submission?</DialogTitle>
          <DialogDescription className="mt-1">
            The {deletingSub?.form.name} submission by {deletingSub?.sub.submittedBy} will be removed{deletingSub?.sub.status === "approved" || deletingSub?.sub.status === "rejected" ? ", including its recorded decision" : ""}.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingSub(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingSub) {
                  updateSubs((all) => all.filter((x) => x.id !== deletingSub.sub.id));
                  setNotice(`Submission by ${deletingSub.sub.submittedBy} deleted.`);
                }
                setDeletingSub(null);
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
