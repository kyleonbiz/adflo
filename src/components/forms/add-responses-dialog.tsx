"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { parseResponses } from "@/lib/forms/share";
import type { FormTemplate } from "@/lib/forms/types";

const textareaClass =
  "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

function Body({ form, onAdd, onClose }: { form: FormTemplate; onAdd: (responses: { submittedBy: string; values: Record<string, string> }[]) => number; onClose: () => void }) {
  const [text, setText] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  return (
    <form
      className="space-y-3 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseResponses(text, form);
        const added = parsed.responses.length > 0 ? onAdd(parsed.responses) : 0;
        const skipped = parsed.responses.length - added;
        const notes = [...parsed.problems, ...(skipped > 0 ? [`${skipped} ${skipped === 1 ? "was" : "were"} already added.`] : [])];
        if (parsed.responses.length > 0 && notes.length === 0) { onClose(); return; }
        setProblems(notes);
        if (added > 0) setText("");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="resp-text">Paste the emails you received</Label>
        <textarea id="resp-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} className={textareaClass} placeholder="Paste one or several emails. AdFlo finds the answers in them." />
      </div>
      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        <Button type="submit" disabled={text.trim() === ""}>Add responses</Button>
      </div>
    </form>
  );
}

/** Bring answers that came back by email into the form's responses. */
export function AddResponsesDialog({ form, onOpenChange, onAdd }: {
  form: FormTemplate | null;
  onOpenChange: (open: boolean) => void;
  /** Adds the answers and returns how many were new (repeats are skipped). */
  onAdd: (form: FormTemplate, responses: { submittedBy: string; values: Record<string, string> }[]) => number;
}) {
  return (
    <Dialog open={form !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {form && (
          <>
            <div className="border-b px-5 py-4 pr-14">
              <DialogTitle>Add responses to &ldquo;{form.name}&rdquo;</DialogTitle>
              <DialogDescription className="mt-1">When someone finishes a form they email you their answers. Paste those emails here to add them.</DialogDescription>
            </div>
            <Body key={form.id} form={form} onAdd={(r) => onAdd(form, r)} onClose={() => onOpenChange(false)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
