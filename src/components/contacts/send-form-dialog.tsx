"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fillLink, type Person } from "@/lib/bridge";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { starterForms } from "@/lib/forms/starter-forms";

const CHOICES = [
  ...starterForms().map((f) => ({ id: f.id, name: f.name })),
  ...PAPERWORK.map((p) => ({ id: p.form.id, name: p.form.name })),
];

/** Pick a form to fill in for a contact; the form opens with their name, email and phone already in. */
export function SendFormDialog({ person, onOpenChange }: { person: Person | null; onOpenChange: (open: boolean) => void }) {
  const [formId, setFormId] = useState(CHOICES[0].id);
  return (
    <Dialog open={person !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Fill out a form for {person?.name}</DialogTitle>
        <DialogDescription className="mt-1">Their details are put into the matching fields. You can change anything before you submit.</DialogDescription>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="send-form">Form</Label>
          <Select value={formId} onValueChange={setFormId}>
            <SelectTrigger id="send-form" aria-label="Form"><SelectValue /></SelectTrigger>
            <SelectContent>{CHOICES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {person && <Button asChild><Link href={fillLink(formId, person)}>Open form</Link></Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
