"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateSubmission, type FieldErrors } from "@/lib/forms/logic";
import type { FormField, FormTemplate } from "@/lib/forms/types";

const textareaClass =
  "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

function FieldInput({ field, value, error, onChange }: { field: FormField; value: string; error?: string; onChange: (v: string) => void }) {
  const id = `fill-${field.id}`;
  const a11y = { "aria-invalid": !!error, "aria-describedby": error ? `${id}-error` : undefined };
  switch (field.type) {
    case "longtext":
      return <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={textareaClass} {...a11y} />;
    case "select":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} {...a11y}><SelectValue placeholder="Choose one" /></SelectTrigger>
          <SelectContent>{field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input id={id} type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} className="size-4 rounded border-input accent-primary" {...a11y} />
          Yes
        </label>
      );
    default:
      return (
        <Input
          id={id}
          type={field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...a11y}
        />
      );
  }
}

/** Fill out a form. Validation runs on submit, and the same rules guard what gets stored. */
export function FillFormDialog({
  open, form, onOpenChange, onSubmit,
}: {
  open: boolean;
  form: FormTemplate | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, string>, submittedBy: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [by, setBy] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const close = (o: boolean) => {
    if (!o) { setValues({}); setBy(""); setErrors({}); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        {form && (
          <>
            <div className="border-b px-5 py-4 pr-14">
              <DialogTitle>{form.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {form.description || "Fill in the fields below."}
                {form.requiresApproval && ` This goes to ${form.approver} for approval.`}
              </DialogDescription>
            </div>
            <form
              noValidate
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                const found = validateSubmission(form, values);
                setErrors(found);
                if (Object.keys(found).length > 0) return;
                onSubmit(values, by);
                close(false);
              }}
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fill-by">Your name</Label>
                  <Input id="fill-by" autoComplete="off" value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} />
                </div>
                {form.fields.map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <Label htmlFor={`fill-${f.id}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                    <FieldInput field={f} value={values[f.id] ?? ""} error={errors[f.id]} onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))} />
                    {errors[f.id] && <p id={`fill-${f.id}-error`} role="alert" className="text-xs text-destructive">{errors[f.id]}</p>}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t px-5 py-3">
                <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
                <Button type="submit">Submit</Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
