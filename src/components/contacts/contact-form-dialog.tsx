"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateContact, type ContactField } from "@/lib/contacts/logic";
import { CONTACT_CATEGORIES, type Contact, type ContactInput } from "@/lib/contacts/types";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Body({ contact, onClose, onSave }: { contact?: Contact; onClose: () => void; onSave: (value: ContactInput) => void }) {
  const [v, setV] = useState<Record<string, string>>({
    name: contact?.name ?? "", email: contact?.email ?? "", phone: contact?.phone ?? "",
    company: contact?.company ?? "", category: contact?.category ?? "Lead", notes: contact?.notes ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const bind = (k: ContactField) => ({
    id: `contact-${k}`, value: v[k], "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `contact-${k}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value })),
  });

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
        <DialogDescription className="mt-1">Names and emails are cleaned up when you save.</DialogDescription>
      </div>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const r = validateContact(v);
          if (r.errors) { setErrors(r.errors); return; }
          onSave(r.value);
          onClose();
        }}
      >
        <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <Field id="contact-name" label="Name" error={errors.name}><Input autoComplete="off" {...bind("name")} /></Field>
          <Field id="contact-company" label="Company" error={errors.company}><Input autoComplete="off" {...bind("company")} /></Field>
          <Field id="contact-email" label="Email" error={errors.email}><Input type="email" autoComplete="off" {...bind("email")} /></Field>
          <Field id="contact-phone" label="Phone" error={errors.phone}><Input autoComplete="off" {...bind("phone")} /></Field>
          <Field id="contact-category" label="Category" error={errors.category}>
            <Select value={v.category} onValueChange={(c) => setV((s) => ({ ...s, category: c }))}>
              <SelectTrigger id="contact-category"><SelectValue /></SelectTrigger>
              <SelectContent>{CONTACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
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
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{contact ? "Save changes" : "Add contact"}</Button>
        </div>
      </form>
    </>
  );
}

export function ContactFormDialog({
  open, contact, onOpenChange, onSave,
}: {
  open: boolean;
  contact?: Contact;
  onOpenChange: (open: boolean) => void;
  onSave: (value: ContactInput) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && <Body contact={contact} onClose={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}
