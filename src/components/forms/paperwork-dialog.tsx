"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDUSTRIES, paperworkFor, type IndustryId, type Paperwork } from "@/lib/forms/paperwork";

/** "Which paperwork do you need?" Pick your kind of business, then the piece of paper. */
export function PaperworkDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (p: Paperwork) => void }) {
  const [industry, setIndustry] = useState<IndustryId>("general");
  const [repeatingOnly, setRepeatingOnly] = useState(false);
  const list = paperworkFor(industry).filter((p) => !repeatingOnly || p.repeats);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Choose paperwork</DialogTitle>
        <DialogDescription className="mt-1">Pick your kind of business, then the form you need. You can print it, save it as a PDF or download it once it is filled in.</DialogDescription>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="paperwork-industry">Your business</Label>
          <Select value={industry} onValueChange={(v) => setIndustry(v as IndustryId)}>
            <SelectTrigger id="paperwork-industry" aria-label="Your business"><SelectValue /></SelectTrigger>
            <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={repeatingOnly} onChange={(e) => setRepeatingOnly(e.target.checked)} className="size-4 rounded border-input accent-primary" />
          Only forms I fill in again and again
        </label>
        <ul className="mt-3 max-h-80 divide-y overflow-y-auto rounded-xl border" aria-label="Paperwork">
          {list.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nothing repeats for this kind of business yet.</li>}
          {list.map((p) => (
            <li key={p.form.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{p.form.name}</span>{p.repeats && <Badge variant="muted">Repeats</Badge>}</p>
                <p className="truncate text-xs text-muted-foreground">{p.use}</p>
              </div>
              <Button size="sm" variant="outline" aria-label={`Fill out: ${p.form.name}`} onClick={() => onPick(p)}>Fill out</Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
