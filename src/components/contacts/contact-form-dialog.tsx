"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findMatches, validateContact, type ContactField } from "@/lib/contacts/logic";
import { CONTACT_CATEGORIES, type Contact, type ContactInput } from "@/lib/contacts/types";
import { titleCase } from "@/lib/text";

const FIELD_ORDER: ContactField[] = ["name", "company", "email", "phone", "category", "lastContacted", "notes"];

function Field({ id, label, error, required, children }: { id: string; label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span aria-hidden className="text-destructive"> *</span>}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Body({
  contact, existing, today, onClose, onSave,
}: { contact?: Contact; existing: Contact[]; today: string; onClose: () => void; onSave: (value: ContactInput) => void }) {
  const [v, setV] = useState<Record<string, string>>({
    name: contact?.name ?? "", email: contact?.email ?? "", phone: contact?.phone ?? "",
    company: contact?.company ?? "", category: contact?.category ?? "Other", notes: contact?.notes ?? "",
    lastContacted: contact?.lastContacted ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [warnedFor, setWarnedFor] = useState("");
  const [matches, setMatches] = useState<ReturnType<typeof findMatches>>([]);
  const bind = (k: ContactField) => ({
    id: `contact-${k}`, value: v[k], "aria-invalid": !!errors[k], "aria-required": k === "name" || undefined, "aria-describedby": errors[k] ? `contact-${k}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value })),
  });

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
        <DialogDescription className="mt-1">Names, emails and phone numbers are tidied when you save.</DialogDescription>
      </div>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const r = validateContact(v);
          if (r.errors) {
            setErrors(r.errors);
            setMatches([]);
            const first = FIELD_ORDER.find((k) => r.errors[k]);
            if (first) requestAnimationFrame(() => document.getElementById(`contact-${first}`)?.focus());
            return;
          }
          setErrors({});
          const found = findMatches(existing, r.value, contact?.id);
          const signature = found.map((m) => m.contact.id).join();
          if (found.length > 0 && signature !== warnedFor) { setMatches(found); setWarnedFor(signature); return; }
          onSave(r.value);
          onClose();
        }}
      >
        <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <Field id="contact-name" label="Name" required error={errors.name}><Input autoComplete="off" {...bind("name")} /></Field>
          <Field id="contact-company" label="Company" error={errors.company}><Input autoComplete="off" {...bind("company")} /></Field>
          <Field id="contact-email" label="Email" error={errors.email}><Input type="email" autoComplete="off" {...bind("email")} /></Field>
          <Field id="contact-phone" label="Phone" error={errors.phone}><Input autoComplete="off" {...bind("phone")} /></Field>
          <Field id="contact-category" label="Category" error={errors.category}>
            <Select value={v.category} onValueChange={(c) => setV((s) => ({ ...s, category: c }))}>
              <SelectTrigger id="contact-category"><SelectValue /></SelectTrigger>
              <SelectContent>{CONTACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="contact-lastContacted" label="Last Contacted" error={errors.lastContacted}>
            <Input type="date" max={today} {...bind("lastContacted")} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="contact-notes" label="Notes" error={errors.notes}>
              <textarea
                rows={3}
                className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                {...bind("notes")}
              />
            </Field>
          </div>
          {matches.length > 0 && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2">
              <p className="font-medium">This looks like someone already in your list:</p>
              <ul className="mt-1 list-disc pl-5">
                {matches.map((m) => <li key={m.contact.id}>{m.contact.name} <span className="text-xs">({m.reasons.join(", ").toLowerCase()})</span></li>)}
              </ul>
              <p className="mt-1 text-xs">Change the details, or save anyway to keep both. You can also merge them later.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{matches.length > 0 ? "Save anyway" : contact ? "Save changes" : "Add contact"}</Button>
        </div>
      </form>
    </>
  );
}

export function ContactFormDialog({
  open, contact, existing, today, onOpenChange, onSave,
}: {
  open: boolean;
  contact?: Contact;
  existing: Contact[];
  today: string;
  onOpenChange: (open: boolean) => void;
  onSave: (value: ContactInput) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && <Body contact={contact} existing={existing} today={today} onClose={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}
