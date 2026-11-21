"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Download, FileText, Printer, Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { SaveResult } from "@/lib/forms/save-document";

/** Shown right after a form is submitted: save it, print it, save it as a PDF, or download it. */
export function DocumentReadyDialog({
  open, title, contact, onOpenChange, onSave, onPrint, onPdf, onText,
}: { open: boolean; title: string; contact?: { name: string; href: string } | null; onOpenChange: (open: boolean) => void; onSave: () => Promise<SaveResult>; onPrint: () => void; onPdf: () => void; onText: () => void }) {
  const [state, setState] = useState<{ saving: boolean; result: SaveResult | null }>({ saving: false, result: null });
  const saved = state.result?.ok === true;
  const save = async () => {
    setState({ saving: true, result: null });
    setState({ saving: false, result: await onSave() });
  };
  const close = (o: boolean) => {
    if (!o) setState({ saving: false, result: null });
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="p-6 max-w-sm">
        <DialogTitle>Your paperwork is ready</DialogTitle>
        <DialogDescription className="mt-1">{title} has been filled in. Save it, or keep a copy now. You can also get it later from the form&apos;s submissions.</DialogDescription>
        <div className="mt-4 grid gap-2">
          <Button onClick={save} disabled={state.saving || saved}>{saved ? <Check /> : <Save />} {state.saving ? "Saving…" : saved ? "Saved" : "Save"}</Button>
          <p role="status" aria-live="polite" className={state.result ? (state.result.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive") : "sr-only"}>{state.result?.message}</p>
          <Button variant="outline" onClick={onPdf}><Download /> Download PDF</Button>
          <Button variant="outline" onClick={onPrint}><Printer /> Print</Button>
          <Button variant="outline" onClick={onText}><FileText /> Download as text</Button>
          {contact && <Button variant="outline" asChild><Link href={contact.href}><UserPlus /> Add {contact.name} to Contacts</Link></Button>}
          <Button variant="ghost" onClick={() => close(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
