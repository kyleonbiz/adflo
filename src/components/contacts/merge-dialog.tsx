"use client";

import { useState } from "react";
import { GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { mergeContacts } from "@/lib/contacts/logic";
import type { Contact } from "@/lib/contacts/types";

const ROWS: { label: string; get: (c: Contact) => string }[] = [
  { label: "Company", get: (c) => c.company },
  { label: "Email", get: (c) => c.email },
  { label: "Phone", get: (c) => c.phone },
  { label: "Category", get: (c) => c.category },
  { label: "Last contacted", get: (c) => c.lastContacted },
  { label: "Notes", get: (c) => c.notes },
];

function Body({ pair, onClose, onMerge }: { pair: [Contact, Contact]; onClose: () => void; onMerge: (keep: Contact, merged: Contact, dropped: Contact) => void }) {
  const [keepId, setKeepId] = useState(pair[0].id);
  const keep = pair.find((c) => c.id === keepId)!;
  const drop = pair.find((c) => c.id !== keepId)!;
  const merged = mergeContacts(keep, drop);

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>Merge contacts</DialogTitle>
        <DialogDescription className="mt-1">Choose the record to keep. Anything it is missing is filled in from the other one, then the other is removed.</DialogDescription>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div role="radiogroup" aria-label="Contact to keep" className="grid gap-3 sm:grid-cols-2">
          {pair.map((c) => (
            <label key={c.id} className={`block cursor-pointer rounded-xl border p-3 text-sm ${c.id === keepId ? "border-primary bg-accent/40" : "hover:bg-muted/50"}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="keep" checked={c.id === keepId} onChange={() => setKeepId(c.id)} className="accent-primary" />
                <span className="font-medium">Keep {c.name}</span>
              </span>
              <dl className="mt-2 space-y-1 text-xs">
                {ROWS.map((r) => (
                  <div key={r.label} className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">{r.label}</dt><dd className="min-w-0 break-words">{r.get(c) || <span className="text-muted-foreground">—</span>}</dd></div>
                ))}
              </dl>
            </label>
          ))}
        </div>
        <div className="rounded-xl border bg-muted/40 p-3 text-sm" aria-live="polite">
          <p className="font-medium">Result: {merged.name}</p>
          <p className="text-xs text-muted-foreground">{[merged.company, merged.email, merged.phone].filter(Boolean).join(" · ") || "No details"}</p>
          {merged.notes && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{merged.notes}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={() => { onMerge(keep, merged, drop); onClose(); }}><GitMerge /> Merge</Button>
      </div>
    </>
  );
}

export function MergeDialog({
  pair, onOpenChange, onMerge,
}: {
  pair: [Contact, Contact] | null;
  onOpenChange: (open: boolean) => void;
  onMerge: (keep: Contact, merged: Contact, dropped: Contact) => void;
}) {
  return (
    <Dialog open={pair !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {pair && <Body key={pair.map((c) => c.id).join()} pair={pair} onClose={() => onOpenChange(false)} onMerge={onMerge} />}
      </DialogContent>
    </Dialog>
  );
}
