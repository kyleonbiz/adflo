"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateSubmission, type FieldErrors } from "@/lib/forms/logic";
import type { FormTemplate } from "@/lib/forms/types";
import { FieldInput } from "./field-input";

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
                  <Label htmlFor="fill-by">Your Name</Label>
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
