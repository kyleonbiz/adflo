"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUSINESS_TYPES, templatesFor, type BusinessTypeId, type LicenseTemplate } from "@/lib/licenses/templates";
import { LICENSE_CATEGORIES } from "@/lib/licenses/types";

/** Pick what kind of business you run, then pick from the licenses, certifications and policies it usually needs. */
export function TemplateDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (template: LicenseTemplate) => void }) {
  const [type, setType] = useState<BusinessTypeId>("general");
  const list = templatesFor(type);
  const categoryLabel = (c: string) => LICENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Start from a template</DialogTitle>
        <DialogDescription className="mt-1">Pick your kind of business, then the item to track. You enter the dates from the real document.</DialogDescription>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="template-business">Your business</Label>
          <Select value={type} onValueChange={(v) => setType(v as BusinessTypeId)}>
            <SelectTrigger id="template-business" aria-label="Your business"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ul className="mt-4 max-h-80 divide-y overflow-y-auto rounded-xl border" aria-label="Templates">
          {list.map((tpl) => (
            <li key={tpl.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{tpl.name}</p>
                <p className="truncate text-xs text-muted-foreground">{categoryLabel(tpl.category)} · renews every {tpl.termMonths % 12 === 0 ? `${tpl.termMonths / 12} yr` : `${tpl.termMonths} mo`}</p>
              </div>
              <Button size="sm" variant="outline" aria-label={`Use template: ${tpl.name}`} onClick={() => onPick(tpl)}>Use</Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
