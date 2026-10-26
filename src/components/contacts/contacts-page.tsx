"use client";

import { useMemo, useState } from "react";
import { Download, GitMerge, Mail, Pencil, Phone, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { applyImport, contactDuplicates, contactsToCsv, mergeContacts, summarize } from "@/lib/contacts/logic";
import { sampleContacts } from "@/lib/contacts/sample-data";
import { CONTACT_CATEGORIES, type Contact, type ContactCategory, type ContactInput } from "@/lib/contacts/types";
import type { ImportOutcome } from "@/lib/import/run";
import { ContactFormDialog } from "./contact-form-dialog";
import { ImportDialog } from "./import-dialog";

const rid = () => `c-${Math.random().toString(36).slice(2, 10)}`;
const CATEGORY_BADGE: Record<ContactCategory, "success" | "default" | "warning" | "muted" | "outline"> = {
  Customer: "success", Lead: "default", Partner: "warning", Vendor: "muted", Other: "outline",
};

function downloadCsv(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * CRM & Data. Contacts live in this component's state (seeded with sample data) until the database is
 * connected, so nothing here is saved between visits. Imports are read in the browser and never uploaded.
 */
export function ContactsPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [edited, setEdited] = useState<Contact[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ContactCategory>("all");
  const [formFor, setFormFor] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [notice, setNotice] = useState("");

  const contacts = useMemo(() => edited ?? (today ? sampleContacts(today) : []), [edited, today]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const saveContact = (value: ContactInput) => {
    if (formFor && formFor !== "new") {
      const id = formFor.id;
      setEdited(contacts.map((c) => (c.id === id ? { ...c, ...value } : c)));
      setNotice(`${value.name} updated.`);
    } else {
      setEdited([...contacts, { ...value, id: rid(), createdOn: today }]);
      setNotice(`${value.name} added.`);
    }
  };

  const runApply = (outcome: ImportOutcome<ContactInput>, mode: "skip" | "update") => {
    const r = applyImport(contacts, outcome, mode, today, rid);
    setEdited(r.contacts);
    setNotice(`Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} skipped, ${outcome.rejected.length} need fixing.`);
  };

  const summary = summarize(contacts);
  const pairs = contactDuplicates(contacts);
  const q = query.trim().toLowerCase();
  const visible = contacts
    .filter((c) => category === "all" || c.category === category)
    .filter((c) => !q || [c.name, c.email, c.phone, c.company].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Module 05</p>
          <h1 className="text-2xl font-semibold tracking-tight">CRM &amp; Data</h1>
          <p className="text-sm text-muted-foreground">Import your contact lists, clean them up, remove duplicates and export tidy data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button>
          <Button variant="outline" disabled={visible.length === 0} onClick={() => downloadCsv(contactsToCsv(visible), `contacts-${today}.csv`)}><Download /> Export CSV</Button>
          <Button onClick={() => setFormFor("new")}><Plus /> Add contact</Button>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={Users} label="Contacts" value={summary.total} tone="text-primary" />
        <SummaryTile icon={GitMerge} label="Possible duplicates" value={summary.duplicatePairs} tone="text-sky-600" />
        <SummaryTile icon={Mail} label="Missing email" value={summary.missingEmail} tone="text-amber-600" />
        <SummaryTile icon={Phone} label="Missing phone" value={summary.missingPhone} tone="text-amber-600" />
      </section>

      <section aria-labelledby="contact-duplicates" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h2 id="contact-duplicates" className="text-base font-semibold">Possible duplicates</h2>
        {pairs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No duplicate contacts found.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {pairs.map((p) => (
              <li key={`${p.a.id}-${p.b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="duplicate-pair">
                <span>
                  <span className="font-medium">{p.a.name}</span> and <span className="font-medium">{p.b.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.reasons.join(", ")}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Merge ${p.b.name} into ${p.a.name}`}
                  onClick={() => {
                    setEdited(contacts.filter((c) => c.id !== p.b.id).map((c) => (c.id === p.a.id ? mergeContacts(p.a, p.b) : c)));
                    setNotice(`Merged ${p.b.name} into ${p.a.name}.`);
                  }}
                >
                  <GitMerge /> Merge
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Contacts" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone or company" aria-label="Search contacts" className="pl-9" />
          </div>
          <div className="sm:w-48">
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger aria-label="Filter by category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CONTACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {contacts.length === 0 ? "No contacts yet. Add one or import a CSV." : "No contacts match these filters."}
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-panel">
            {visible.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="contact-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    <Badge variant={CATEGORY_BADGE[c.category]}>{c.category}</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{[c.company, c.email, c.phone].filter(Boolean).join(" · ") || "No details"}</p>
                  {c.notes && <p className="truncate text-xs text-muted-foreground">{c.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setFormFor(c)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ContactFormDialog open={formFor !== null} contact={formFor && formFor !== "new" ? formFor : undefined} onOpenChange={(o) => !o && setFormFor(null)} onSave={saveContact} />
      <ImportDialog open={importing} existing={contacts} onOpenChange={setImporting} onImport={runApply} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete contact?</DialogTitle>
          <DialogDescription className="mt-1">{deleting?.name} will be removed.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) { setEdited(contacts.filter((c) => c.id !== deleting.id)); setNotice(`${deleting.name} deleted.`); }
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
