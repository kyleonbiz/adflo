"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, FileInput, Hourglass, Inbox, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { createSubmission, decide, generateDocument, submissionsToCsv, summarize } from "@/lib/forms/logic";
import { starterForms } from "@/lib/forms/starter-forms";
import { e2eSeed } from "@/lib/e2e-seed";
import type { FormTemplate, Submission } from "@/lib/forms/types";
import { useSetupConfig } from "@/lib/setup/storage";
import { installedForms } from "@/lib/setup/templates";
import type { FormBuilderValues } from "@/lib/forms/validation";
import { FillFormDialog } from "./fill-form-dialog";
import { FormBuilderDialog } from "./form-builder-dialog";
import { FormCard, type FormActions } from "./form-card";

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
 * Forms & Paperwork. Forms and submissions live in this component's state (starting empty)
 * until the database is connected, so nothing here is saved between visits and no notifications are sent.
 */
export function FormsPage({ preview, initialQuery = "" }: { preview?: string; initialQuery?: string }) {
  const today = useToday();
  const [editedForms, setEditedForms] = useState<FormTemplate[] | null>(null);
  const [editedSubs, setEditedSubs] = useState<Submission[] | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [builderFor, setBuilderFor] = useState<FormTemplate | "new" | null>(null);
  const [filling, setFilling] = useState<FormTemplate | null>(null);
  const [deleting, setDeleting] = useState<FormTemplate | null>(null);
  const [notice, setNotice] = useState("");

  const setup = useSetupConfig();
  // Forms installed by Settings (only once setup is finished) sit alongside your own records.
  const forms = useMemo(() => editedForms ?? [...starterForms(), ...installedForms(setup?.completedOn ? setup.templates : [])], [editedForms, setup]);
  const subs = useMemo(() => editedSubs ?? e2eSeed<Submission>("submissions") ?? [], [editedSubs]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const actions: FormActions = {
    onFill: (f) => setFilling(f),
    onEdit: (f) => setBuilderFor(f),
    onDelete: (f) => setDeleting(f),
    onDecide: (f, s, decision, comment) => {
      setEditedSubs(subs.map((x) => (x.id === s.id ? decide(x, decision, f.approver || "Approver", today, comment) : x)));
      setNotice(`Submission by ${s.submittedBy} ${decision}.`);
    },
    onDocument: (f, s) => download(generateDocument(f, s), `${slug(f.name)}-${slug(s.submittedBy)}-${s.submittedOn}.txt`, "text/plain"),
    onExport: (f, list) => download(submissionsToCsv(f, list), `${slug(f.name)}-submissions-${today}.csv`, "text/csv"),
    onDeleteSubmission: (_f, s) => {
      setEditedSubs(subs.filter((x) => x.id !== s.id));
      setNotice(`Submission by ${s.submittedBy} deleted.`);
    },
  };

  const saveForm = (v: FormBuilderValues) => {
    const fields = v.fields.map((f) => ({ ...f, type: f.type as FormTemplate["fields"][number]["type"] }));
    const next = { name: v.name, description: v.description, fields, requiresApproval: v.requiresApproval, approver: v.requiresApproval ? v.approver : "", documentTemplate: v.documentTemplate };
    if (builderFor && builderFor !== "new") {
      const id = builderFor.id;
      setEditedForms(forms.map((f) => (f.id === id ? { ...f, ...next } : f)));
      setNotice(`${v.name} updated.`);
    } else {
      setEditedForms([...forms, { ...next, id: rid("form") }]);
      setNotice(`${v.name} created.`);
    }
  };

  const summary = summarize(forms, subs, today);
  const q = query.trim().toLowerCase();
  const visible = forms.filter((f) => !q || [f.name, f.description].some((x) => x.toLowerCase().includes(q)));

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
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={FileInput} label="Forms" value={summary.forms} tone="text-primary" />
        <SummaryTile icon={Inbox} label="Submissions" value={summary.submissions} tone="text-sky-600" />
        <SummaryTile icon={Hourglass} label="Awaiting approval" value={summary.pending} tone="text-amber-600" />
        <SummaryTile icon={ClipboardCheck} label="Decided this month" value={summary.decidedThisMonth} tone="text-emerald-600" />
      </section>

      <section aria-label="Forms" className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search forms" aria-label="Search forms" className="pl-9" />
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {forms.length === 0 ? "No forms yet. Create your first one." : "No forms match your search."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((f) => <FormCard key={f.id} form={f} submissions={subs.filter((s) => s.formId === f.id)} actions={actions} />)}
          </ul>
        )}
      </section>

      <FormBuilderDialog
        open={builderFor !== null}
        form={builderFor && builderFor !== "new" ? builderFor : undefined}
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
          setEditedSubs([...subs, s]);
          setNotice(filling.requiresApproval ? `Submitted. Waiting for ${filling.approver} to approve.` : "Submitted. Thank you.");
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete form?</DialogTitle>
          <DialogDescription className="mt-1">{deleting?.name} and all of its submissions will be removed.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  setEditedForms(forms.filter((f) => f.id !== deleting.id));
                  setEditedSubs(subs.filter((s) => s.formId !== deleting.id));
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
