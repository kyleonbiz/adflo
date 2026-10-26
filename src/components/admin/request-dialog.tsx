"use client";

import { useMemo, useState } from "react";
import { Mail, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseEmailText } from "@/lib/admin/email";
import type { NewRequest } from "@/lib/admin/logic";
import { approvalReasons, suggestCategory, suggestPriority } from "@/lib/admin/triage";
import { CATEGORIES, PRIORITIES, type Category, type Priority, type RequestSource } from "@/lib/admin/types";
import { requestFormSchema } from "@/lib/admin/validation";

const textareaClass =
  "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Body({ onClose, onSave }: { onClose: () => void; onSave: (r: NewRequest) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requester, setRequester] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [category, setCategory] = useState<Category | "auto">("auto");
  const [priority, setPriority] = useState<Priority | "auto">("auto");
  const [source, setSource] = useState<RequestSource>("manual");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const text = `${title}\n${description}`;
  const suggestion = useMemo(() => suggestCategory(text), [text]);
  const shownCategory = category === "auto" ? suggestion.category : category;
  const shownPriority = priority === "auto" ? suggestPriority(text) : priority;
  const reasons = useMemo(() => approvalReasons(title, description, shownCategory), [title, description, shownCategory]);

  const fillFromEmail = () => {
    const parsed = parseEmailText(emailText);
    if (!parsed.title && !parsed.description) { setErrors({ email: "Paste an email first." }); return; }
    setTitle(parsed.title);
    setDescription(parsed.description);
    setRequester(parsed.requester);
    setSource("email");
    setEmailOpen(false);
    setErrors({});
  };

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>New request</DialogTitle>
        <DialogDescription className="mt-1">Describe what you need. We suggest a category and priority, and flag anything that needs approval first.</DialogDescription>
      </div>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = requestFormSchema.safeParse({ title, description, requester, category: shownCategory, priority: shownPriority, dueOn });
          if (!parsed.success) {
            setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
            return;
          }
          onSave({ ...parsed.data, requester: parsed.data.requester || "Me", source });
          onClose();
        }}
      >
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <Button type="button" size="sm" variant="outline" aria-expanded={emailOpen} onClick={() => setEmailOpen((o) => !o)}><Mail /> Fill from a pasted email</Button>
            {emailOpen && (
              <div className="mt-2 space-y-2">
                <textarea rows={5} value={emailText} onChange={(e) => setEmailText(e.target.value)} aria-label="Pasted email" className={`${textareaClass} font-mono text-xs`} placeholder={"From: Dana <dana@example.com>\nSubject: Please reschedule Thursday\n\nCould you move the call to Friday?"} />
                {errors.email && <p role="alert" className="text-xs text-destructive">{errors.email}</p>}
                <Button type="button" size="sm" onClick={fillFromEmail}>Fill the form</Button>
              </div>
            )}
          </div>

          <Field id="req-title" label="Title" error={errors.title}>
            <Input id="req-title" autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
          </Field>
          <Field id="req-description" label="Details" error={errors.description}>
            <textarea id="req-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} aria-invalid={!!errors.description} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="req-requester" label="From" error={errors.requester}>
              <Input id="req-requester" autoComplete="off" value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Who is asking?" />
            </Field>
            <Field id="req-due" label="Due date (optional)" error={errors.dueOn}>
              <Input id="req-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-invalid={!!errors.dueOn} />
            </Field>
            <Field id="req-category" label="Category" error={errors.category}>
              <Select value={category} onValueChange={(v) => setCategory(v as Category | "auto")}>
                <SelectTrigger id="req-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Suggested: {suggestion.category}</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="req-priority" label="Priority" error={errors.priority}>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority | "auto")}>
                <SelectTrigger id="req-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Suggested: {suggestPriority(text)}</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {suggestion.matched.length > 0 && category === "auto" && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="suggestion-why">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              Suggested {suggestion.category} ({suggestion.confidence} confidence) from: {suggestion.matched.join(", ")}.
            </p>
          )}
          {reasons.length > 0 && (
            <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="approval-note">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>This will wait for approval before any work starts: {reasons.join("; ")}.</span>
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{reasons.length > 0 ? "Submit for approval" : "Create request"}</Button>
        </div>
      </form>
    </>
  );
}

export function RequestDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (r: NewRequest) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">{open && <Body onClose={() => onOpenChange(false)} onSave={onSave} />}</DialogContent>
    </Dialog>
  );
}
