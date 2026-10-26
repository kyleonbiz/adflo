"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_TYPES, type FieldType, type FormField, type FormTemplate } from "@/lib/forms/types";
import { formBuilderSchema, type FormBuilderValues } from "@/lib/forms/validation";

const rid = () => `f-${Math.random().toString(36).slice(2, 8)}`;
const textareaClass =
  "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

interface Draft {
  name: string;
  description: string;
  fields: (Omit<FormField, "options"> & { optionsText: string })[];
  requiresApproval: boolean;
  approver: string;
  documentTemplate: string;
}

function toDraft(form?: FormTemplate): Draft {
  if (!form) {
    return { name: "", description: "", fields: [{ id: rid(), label: "Name", type: "text", required: true, optionsText: "" }], requiresApproval: false, approver: "", documentTemplate: "" };
  }
  return {
    name: form.name, description: form.description, requiresApproval: form.requiresApproval,
    approver: form.approver, documentTemplate: form.documentTemplate,
    fields: form.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required, optionsText: f.options.join(", ") })),
  };
}

/** Build or edit a form template. The dialog is keyed by the caller so each open starts from fresh state. */
function BuilderBody({ form, onClose, onSave }: { form?: FormTemplate; onClose: () => void; onSave: (values: FormBuilderValues) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(form));
  const [problems, setProblems] = useState<string[]>([]);

  const setField = (id: string, change: Partial<Draft["fields"][number]>) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...change } : f)) }));
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      const fields = [...d.fields];
      const j = i + by;
      if (j < 0 || j >= fields.length) return d;
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...d, fields };
    });

  const save = () => {
    const parsed = formBuilderSchema.safeParse({
      ...draft,
      fields: draft.fields.map(({ optionsText, ...f }) => ({
        ...f,
        options: f.type === "select" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : [],
      })),
    });
    if (!parsed.success) {
      setProblems([...new Set(parsed.error.issues.map((i) => i.message))]);
      return;
    }
    onSave(parsed.data);
    onClose();
  };

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>{form ? "Edit form" : "New form"}</DialogTitle>
        <DialogDescription className="mt-1">Define the fields, who approves, and the document it produces.</DialogDescription>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fb-name">Form name</Label>
            <Input id="fb-name" autoComplete="off" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-description">Description</Label>
            <Input id="fb-description" autoComplete="off" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Fields</legend>
          <ul className="space-y-2">
            {draft.fields.map((f, i) => (
              <li key={f.id} className="space-y-2 rounded-xl border p-3" data-testid="builder-field">
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto_auto]">
                  <Input value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} placeholder="Field label" aria-label={`Label of field ${i + 1}`} className="h-9" />
                  <Select value={f.type} onValueChange={(v) => setField(f.id, { type: v as FieldType })}>
                    <SelectTrigger aria-label={`Type of field ${i + 1}`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={f.required} onChange={(e) => setField(f.id, { required: e.target.checked })} className="size-4 rounded border-input accent-primary" />
                    Required
                  </label>
                  <div className="flex items-center">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move field ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move field ${i + 1} down`} disabled={i === draft.fields.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove field ${i + 1}`} disabled={draft.fields.length === 1} onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((x) => x.id !== f.id) }))}><Trash2 /></Button>
                  </div>
                </div>
                {f.type === "select" && (
                  <Input value={f.optionsText} onChange={(e) => setField(f.id, { optionsText: e.target.value })} placeholder="Options, separated by commas" aria-label={`Options of field ${i + 1}`} className="h-9" />
                )}
              </li>
            ))}
          </ul>
          <Button type="button" size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, fields: [...d.fields, { id: rid(), label: "", type: "text", required: false, optionsText: "" }] }))}>
            <Plus /> Add field
          </Button>
        </fieldset>

        <div className="space-y-2 rounded-xl border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={draft.requiresApproval} onChange={(e) => setDraft({ ...draft, requiresApproval: e.target.checked })} className="size-4 rounded border-input accent-primary" />
            Submissions need approval
          </label>
          {draft.requiresApproval && (
            <div className="space-y-1.5">
              <Label htmlFor="fb-approver">Approver</Label>
              <Input id="fb-approver" autoComplete="off" value={draft.approver} onChange={(e) => setDraft({ ...draft, approver: e.target.value })} placeholder="Name or role" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fb-template">Document template (optional)</Label>
          <textarea id="fb-template" rows={5} value={draft.documentTemplate} onChange={(e) => setDraft({ ...draft, documentTemplate: e.target.value })} className={textareaClass}
            placeholder={"Write the document and drop in fields like {{Field label}}.\nLeave empty for a simple list of answers."} />
        </div>

        {problems.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={save}>{form ? "Save changes" : "Create form"}</Button>
      </div>
    </>
  );
}

export function FormBuilderDialog({
  open, form, onOpenChange, onSave,
}: {
  open: boolean;
  form?: FormTemplate;
  onOpenChange: (open: boolean) => void;
  onSave: (values: FormBuilderValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && <BuilderBody form={form} onClose={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}
