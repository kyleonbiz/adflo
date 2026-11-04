"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Download, FileText, Inbox, Pencil, Play, Printer, Send, Trash2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLong } from "@/lib/dates";
import { displayValue } from "@/lib/forms/logic";
import type { FormTemplate, Submission } from "@/lib/forms/types";
import { cn } from "@/lib/utils";
import { SUBMISSION_BADGE, SUBMISSION_LABEL } from "./status";

export interface FormActions {
  onSend: (form: FormTemplate) => void;
  onFill: (form: FormTemplate) => void;
  onEdit: (form: FormTemplate) => void;
  onDelete: (form: FormTemplate) => void;
  onAddResponses: (form: FormTemplate) => void;
  onMarkDone: (form: FormTemplate, s: Submission, done: boolean) => void;
  onDocument: (form: FormTemplate, s: Submission) => void;
  onPdf: (form: FormTemplate, s: Submission) => void;
  onPrint: (form: FormTemplate, s: Submission) => void;
  onExport: (form: FormTemplate, subs: Submission[]) => void;
  onDeleteSubmission: (form: FormTemplate, s: Submission) => void;
}

function ResponseRow({ form, s, actions }: { form: FormTemplate; s: Submission; actions: FormActions }) {
  const summary = form.fields.slice(0, 3).map((f) => displayValue(f, s.values[f.id])).filter(Boolean).join(" · ");
  return (
    <li className="space-y-2 rounded-xl border p-3 text-sm" data-testid="submission-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{s.submittedBy} <span className="font-normal text-muted-foreground">· {formatDayLong(s.submittedOn)}</span></p>
          {summary && <p className="truncate text-muted-foreground">{summary}</p>}
        </div>
        <Badge variant={SUBMISSION_BADGE[s.status]}>{SUBMISSION_LABEL[s.status]}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {s.status === "new" ? (
          <Button size="sm" variant="outline" aria-label={`Mark response by ${s.submittedBy} done`} onClick={() => actions.onMarkDone(form, s, true)}><CheckCircle2 /> Mark done</Button>
        ) : (
          <Button size="sm" variant="ghost" aria-label={`Reopen response by ${s.submittedBy}`} onClick={() => actions.onMarkDone(form, s, false)}><Undo2 /> Reopen</Button>
        )}
        <Button size="sm" variant="ghost" aria-label={`Document for response by ${s.submittedBy}`} onClick={() => actions.onDocument(form, s)}><FileText /> Document</Button>
        <Button size="sm" variant="ghost" aria-label={`PDF for response by ${s.submittedBy}`} onClick={() => actions.onPdf(form, s)}><Download /> PDF</Button>
        <Button size="sm" variant="ghost" aria-label={`Print response by ${s.submittedBy}`} onClick={() => actions.onPrint(form, s)}><Printer /> Print</Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Delete response by ${s.submittedBy}`} onClick={() => actions.onDeleteSubmission(form, s)}><Trash2 /></Button>
      </div>
    </li>
  );
}

export function FormCard({ form, submissions, actions }: { form: FormTemplate; submissions: Submission[]; actions: FormActions }) {
  const [open, setOpen] = useState(false);
  const unread = submissions.filter((s) => s.status === "new").length;
  const panelId = `form-subs-${form.id}`;

  return (
    <li className="rounded-2xl border bg-card shadow-panel" data-testid="form-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{form.name}</h3>
            {unread > 0 && <Badge variant="default">{unread} new</Badge>}
          </div>
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
          <p className="text-xs text-muted-foreground">
            {form.fields.length} field{form.fields.length === 1 ? "" : "s"} · sent {form.sentCount} time{form.sentCount === 1 ? "" : "s"} · {submissions.length} response{submissions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => actions.onSend(form)}><Send /> Send</Button>
          <Button size="sm" variant="outline" onClick={() => actions.onFill(form)}><Play /> Fill out</Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${form.name}`} onClick={() => actions.onEdit(form)}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${form.name}`} onClick={() => actions.onDelete(form)}><Trash2 /></Button>
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
          <span>Responses <span className="font-normal text-muted-foreground">{submissions.length}</span></span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div id={panelId} className="space-y-3 px-4 pb-4">
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" aria-label={`Add responses to ${form.name}`} onClick={() => actions.onAddResponses(form)}><Inbox /> Add responses</Button>
              {submissions.length > 0 && <Button size="sm" variant="outline" onClick={() => actions.onExport(form, submissions)}><Download /> Export CSV</Button>}
            </div>
            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No responses yet. Send the form, then add the answers people email back.</p>
            ) : (
              <ul className="space-y-2">
                {[...submissions].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1)).map((s) => (
                  <ResponseRow key={s.id} form={form} s={s} actions={actions} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
