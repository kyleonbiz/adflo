"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateSubmission, type FieldErrors } from "@/lib/forms/logic";
import { responseMailto, responseMessage, type SharedForm } from "@/lib/forms/share";
import type { FormField } from "@/lib/forms/types";
import { FieldInput } from "./field-input";

/** The page a recipient sees. Answers are checked here, then handed back to them as an email to send. */
export function PublicForm({ form }: { form: SharedForm }) {
  const fields = form.fields as FormField[];
  const [values, setValues] = useState<Record<string, string>>({});
  const [by, setBy] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const asTemplate = { ...form, fields, documentTemplate: "", sentCount: 0 };
  const message = ready ? responseMessage(form, by, values) : "";

  if (ready) {
    return (
      <section aria-label="Send your answers" className="space-y-4" data-testid="public-form-done">
        <h2 className="text-lg font-semibold">Your answers are ready</h2>
        <p className="text-sm text-muted-foreground">Nothing has been sent yet. Open the email below and press send so your answers reach the person who sent you this form.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild><a href={responseMailto(form, by, values)}><Mail /> Email my answers</a></Button>
          <Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); } }}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy my answers"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setReady(false)}>Change my answers</Button>
        </div>
        <p className="text-xs text-muted-foreground">If your email app does not open, copy your answers and email them to {form.replyTo}.</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/40 p-3 text-xs">{message}</pre>
      </section>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const found = validateSubmission(asTemplate, values);
        setErrors(found);
        if (Object.keys(found).length === 0) setReady(true);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="fill-by">Your name</Label>
        <Input id="fill-by" autoComplete="name" value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} />
      </div>
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={`fill-${f.id}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
          <FieldInput field={f} value={values[f.id] ?? ""} error={errors[f.id]} onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))} />
          {errors[f.id] && <p id={`fill-${f.id}-error`} role="alert" className="text-xs text-destructive">{errors[f.id]}</p>}
        </div>
      ))}
      <Button type="submit">Review my answers</Button>
    </form>
  );
}
