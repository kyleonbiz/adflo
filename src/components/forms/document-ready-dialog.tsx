"use client";

import { Download, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Shown right after a form is submitted: print it, save it as a PDF, or download it. */
export function DocumentReadyDialog({
  open, title, onOpenChange, onPrint, onPdf, onText,
}: { open: boolean; title: string; onOpenChange: (open: boolean) => void; onPrint: () => void; onPdf: () => void; onText: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Your paperwork is ready</DialogTitle>
        <DialogDescription className="mt-1">{title} has been filled in. Keep a copy now, or get it later from the form&apos;s submissions.</DialogDescription>
        <div className="mt-4 grid gap-2">
          <Button onClick={onPrint}><Printer /> Print</Button>
          <Button variant="outline" onClick={onPdf}><Download /> Download PDF</Button>
          <Button variant="outline" onClick={onText}><FileText /> Download as text</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
