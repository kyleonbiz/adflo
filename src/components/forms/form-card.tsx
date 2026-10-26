"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Download, FileText, Pencil, Play, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayLong } from "@/lib/dates";
import { displayValue, sortSubmissions } from "@/lib/forms/logic";
import type { FormTemplate, Submission } from "@/lib/forms/types";
import { cn } from "@/lib/utils";
import { SUBMISSION_BADGE, SUBMISSION_LABEL } from "./status";

export interface FormActions {
  onFill: (form: FormTemplate) => void;
  onEdit: (form: FormTemplate) => void;
  onDelete: (form: FormTemplate) => void;
  onDecide: (form: FormTemplate, s: Submission, decision: "approved" | "rejected", comment: string) => void;
  onDocument: (form: FormTemplate, s: Submission) => void;
  onExport: (form: FormTemplate, subs: Submission[]) => void;
  onDeleteSubmission: (form: FormTemplate, s: Submission) => void;
}

function SubmissionRow({ form, s, actions }: { form: FormTemplate; s: Submission; actions: FormActions }) {
  const [comment, setComment] = useState("");
  const [reasonNeeded, setReasonNeeded] = useState(false);
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
      {s.decidedBy && s.decidedOn && (
        <p className="text-xs text-muted-foreground">
          {s.status === "approved" ? "Approved" : "Rejected"} by {s.decidedBy} on {formatDayLong(s.decidedOn)}{s.comment && `: ${s.comment}`}
        </p>
      )}
      {reasonNeeded && <p id={`reason-${s.id}`} role="alert" className="text-xs text-destructive">Add a short reason so the submitter knows why it was rejected.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {s.status === "pending" && (
          <>
            <Input value={comment} onChange={(e) => { setComment(e.target.value); setReasonNeeded(false); }} placeholder="Comment (required to reject)" aria-label={`Comment on submission by ${s.submittedBy}`} aria-invalid={reasonNeeded} aria-describedby={reasonNeeded ? `reason-${s.id}` : undefined} className="h-8 max-w-56 text-xs" maxLength={200} />
            <Button size="sm" variant="outline" aria-label={`Approve submission by ${s.submittedBy}`} onClick={() => actions.onDecide(form, s, "approved", comment)}><CheckCircle2 /> Approve</Button>
            <Button size="sm" variant="outline" aria-label={`Reject submission by ${s.submittedBy}`} onClick={() => (comment.trim() ? actions.onDecide(form, s, "rejected", comment) : setReasonNeeded(true))}><XCircle /> Reject</Button>
          </>
        )}
        <Button size="sm" variant="ghost" aria-label={`Document for submission by ${s.submittedBy}`} onClick={() => actions.onDocument(form, s)}><FileText /> Document</Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Delete submission by ${s.submittedBy}`} onClick={() => actions.onDeleteSubmission(form, s)}><Trash2 /></Button>
      </div>
    </li>
  );
}

/** `focusKey` changes whenever the page wants this card shown: it opens the submissions and scrolls to the card. */
export function FormCard({ form, submissions, actions, focusKey }: { form: FormTemplate; submissions: Submission[]; actions: FormActions; focusKey?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const [seenFocus, setSeenFocus] = useState(focusKey);
  if (focusKey !== seenFocus) {
    setSeenFocus(focusKey);
    if (focusKey !== undefined) setOpen(true);
  }
  useEffect(() => {
    if (focusKey !== undefined) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusKey]);
  const pending = submissions.filter((s) => s.status === "pending").length;
  const panelId = `form-subs-${form.id}`;

  return (
    <li ref={ref} className="scroll-mt-4 rounded-2xl border bg-card shadow-panel" data-testid="form-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{form.name}</h3>
            {form.requiresApproval && <Badge variant="muted">Approval: {form.approver}</Badge>}
            {pending > 0 && <Badge variant="warning">{pending} awaiting approval</Badge>}
          </div>
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
          <p className="text-xs text-muted-foreground">{form.fields.length} field{form.fields.length === 1 ? "" : "s"} · {submissions.length} submission{submissions.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => actions.onFill(form)}><Play /> Fill out</Button>
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
          <span>Submissions <span className="font-normal text-muted-foreground">{submissions.length}</span></span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div id={panelId} className="space-y-3 px-4 pb-4">
            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => actions.onExport(form, submissions)}><Download /> Export CSV</Button>
                </div>
                <ul className="space-y-2">
                  {sortSubmissions(submissions).map((s) => (
                    <SubmissionRow key={s.id} form={form} s={s} actions={actions} />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
