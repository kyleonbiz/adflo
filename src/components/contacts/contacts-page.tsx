"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Download, GitMerge, Mail, Pencil, Phone, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { downloadText } from "@/components/import/csv-source";
import { daysBetween, formatDayShort } from "@/lib/dates";
import { applyImport, contactDuplicates, contactsToCsv, isStale, STALE_DAYS, summarize } from "@/lib/contacts/logic";
import { e2eSeed } from "@/lib/e2e-seed";
import { CONTACT_CATEGORIES, type Contact, type ContactCategory, type ContactInput } from "@/lib/contacts/types";
import type { ImportOutcome } from "@/lib/import/run";
import { ContactFormDialog } from "./contact-form-dialog";
import { ImportDialog } from "./import-dialog";
import { MergeDialog } from "./merge-dialog";
import { titleCase } from "@/lib/text";

const rid = () => `c-${Math.random().toString(36).slice(2, 10)}`;
const CATEGORY_BADGE: Record<ContactCategory, "success" | "default" | "warning" | "muted" | "outline"> = {
  Customer: "success", Lead: "default", Partner: "warning", Vendor: "muted", Other: "outline",
};

type SortKey = "name" | "company" | "newest" | "contacted";
const SORT_LABEL: Record<SortKey, string> = { name: "Name", company: "Company", newest: "Newest first", contacted: "Longest since contact" };
type Quick = "all" | "missingEmail" | "missingPhone" | "duplicates" | "stale";
const QUICK_LABEL: Record<Quick, string> = {
  all: "All contacts", missingEmail: "Missing email", missingPhone: "Missing phone", duplicates: "Possible duplicates", stale: `No contact in ${STALE_DAYS}+ days`,
};
const PAGE = 50;
const PAIRS_SHOWN = 3;
const NOTICE_MS = 12_000;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const linkClass = "rounded underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * CRM & Data. Contacts live in this component's state (starting empty) until the database is
 * connected, so nothing here is saved between visits. Imports are read in the browser and never uploaded.
 */
export function ContactsPage({ preview, initialQuery = "" }: { preview?: string; initialQuery?: string }) {
  const today = useToday();
  const [edited, setEdited] = useState<Contact[] | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<"all" | ContactCategory>("all");
  const [quick, setQuick] = useState<Quick>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allPairs, setAllPairs] = useState(false);
  const [formFor, setFormFor] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<Contact[] | null>(null);
  const [merging, setMerging] = useState<[Contact, Contact] | null>(null);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<Contact[] | null>(null);

  const seed = useMemo(() => e2eSeed<Contact>("contacts") ?? [], []);
  const contacts = edited ?? seed;
  const pairs = useMemo(() => contactDuplicates(contacts), [contacts]);
  const summary = useMemo(() => (today ? summarize(contacts, today, pairs) : null), [contacts, today, pairs]);
  const duplicateIds = useMemo(() => new Set(pairs.flatMap((p) => [p.a.id, p.b.id])), [pairs]);

  // Action results stay visible long enough to read (and to undo), then clear.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => { setNotice(""); setUndo(null); }, NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const q = query.trim().toLowerCase();
  const filtered = q !== "" || category !== "all" || quick !== "all";
  const visible = useMemo(() => {
    if (!today) return [];
    const byName = (a: Contact, b: Contact) => a.name.localeCompare(b.name);
    return contacts
      .filter((c) => category === "all" || c.category === category)
      .filter((c) => !q || [c.name, c.email, c.phone, c.company, c.notes, c.category].some((f) => f.toLowerCase().includes(q)))
      .filter((c) =>
        quick === "all" ? true
        : quick === "missingEmail" ? !c.email
        : quick === "missingPhone" ? !c.phone
        : quick === "duplicates" ? duplicateIds.has(c.id)
        : isStale(c, today))
      .sort((a, b) =>
        sort === "company" ? (a.company || "￿").localeCompare(b.company || "￿") || byName(a, b)
        : sort === "newest" ? b.createdOn.localeCompare(a.createdOn) || byName(a, b)
        : sort === "contacted" ? (a.lastContacted || "").localeCompare(b.lastContacted || "") || byName(a, b)
        : byName(a, b));
  }, [contacts, category, q, quick, sort, duplicateIds, today]);

  if (!today || !summary) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  /** Every change goes through here so it can be undone from the notice. */
  const commit = (next: Contact[], message: string) => {
    setUndo(contacts);
    setEdited(next);
    setNotice(message);
  };
  const clearFilters = () => { setQuery(""); setCategory("all"); setQuick("all"); setShown(PAGE); };
  const toggleQuick = (k: Exclude<Quick, "all">) => { setQuick(quick === k ? "all" : k); setShown(PAGE); };

  const saveContact = (value: ContactInput) => {
    if (formFor && formFor !== "new") {
      const id = formFor.id;
      commit(contacts.map((c) => (c.id === id ? { ...c, ...value } : c)), `${value.name} updated.`);
    } else {
      commit([...contacts, { ...value, id: rid(), createdOn: today }], `${value.name} added.`);
    }
  };

  const runApply = (outcome: ImportOutcome<ContactInput>, mode: "skip" | "update") => {
    const r = applyImport(contacts, outcome, mode, today, rid);
    commit(r.contacts, `Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} skipped, ${outcome.rejected.length} need fixing.`);
  };

  const doMerge = (keep: Contact, merged: Contact, dropped: Contact) => {
    commit(contacts.filter((c) => c.id !== dropped.id).map((c) => (c.id === keep.id ? merged : c)), `Merged ${dropped.name} into ${keep.name}.`);
    setSelected(new Set());
  };

  const selectedContacts = contacts.filter((c) => selected.has(c.id));
  const allShownSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const exportCsv = () => {
    downloadText(contactsToCsv(visible), `contacts-${today}.csv`);
    setNotice(`Exported ${visible.length} contact${visible.length === 1 ? "" : "s"}${filtered ? " (filtered list)" : ""}.`);
    setUndo(null);
  };

  const rows = visible.slice(0, shown);
  const pairRows = allPairs ? pairs : pairs.slice(0, PAIRS_SHOWN);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM &amp; Data</h1>
          <p className="text-sm text-muted-foreground">Keep your contacts in one place: import lists, clean them up, merge duplicates, track who needs a follow-up and export tidy data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button>
          <Button variant="outline" disabled={visible.length === 0} onClick={exportCsv}>
            <Download /> Export CSV{filtered && visible.length > 0 ? ` (${visible.length} shown)` : ""}
          </Button>
          <Button onClick={() => setFormFor("new")}><Plus /> Add contact</Button>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <div role="status" aria-live="polite" className={notice ? "sticky top-2 z-20 flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm shadow-float" : "sr-only"}>
        <span>{notice}</span>
        {notice && (
          <span className="flex shrink-0 items-center gap-3">
            {undo && (
              <button type="button" onClick={() => { setEdited(undo); setUndo(null); setNotice("Undone."); setSelected(new Set()); }} className="rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Undo</button>
            )}
            <button type="button" aria-label="Dismiss message" onClick={() => { setNotice(""); setUndo(null); }} className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-4" aria-hidden />
            </button>
          </span>
        )}
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryTile icon={Users} label="Contacts" value={summary.total} tone="text-primary" onClick={clearFilters} />
        <SummaryTile icon={GitMerge} label="Possible duplicates" value={summary.duplicatePairs} tone="text-sky-600" href={summary.duplicatePairs > 0 ? "#contact-duplicates" : undefined} />
        <SummaryTile icon={Mail} label="Missing email" value={summary.missingEmail} tone="text-amber-600" pressed={quick === "missingEmail"} onClick={() => toggleQuick("missingEmail")} />
        <SummaryTile icon={Phone} label="Missing phone" value={summary.missingPhone} tone="text-amber-600" pressed={quick === "missingPhone"} onClick={() => toggleQuick("missingPhone")} />
        <SummaryTile icon={Clock} label={`No contact in ${STALE_DAYS}+ days`} value={summary.stale} tone="text-amber-600" pressed={quick === "stale"} onClick={() => toggleQuick("stale")} />
      </section>

      {pairs.length > 0 && (
        <section id="contact-duplicates" aria-labelledby="contact-duplicates-title" className="scroll-mt-4 rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="contact-duplicates-title" className="flex items-center gap-2 text-base font-semibold"><GitMerge className="size-4 text-sky-600" aria-hidden /> Possible duplicates</h2>
          <ul className="mt-2 divide-y">
            {pairRows.map((p) => (
              <li key={`${p.a.id}-${p.b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="duplicate-pair">
                <span>
                  <span className="font-medium">{p.a.name}</span> and <span className="font-medium">{p.b.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.reasons.join(", ")}</span>
                </span>
                <Button size="sm" variant="outline" aria-label={`Review merge of ${p.b.name} and ${p.a.name}`} onClick={() => setMerging([p.a, p.b])}>
                  <GitMerge /> Review &amp; merge
                </Button>
              </li>
            ))}
          </ul>
          {pairs.length > PAIRS_SHOWN && (
            <button type="button" onClick={() => setAllPairs(!allPairs)} className="mt-2 rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {allPairs ? "Show fewer" : `Show all ${pairs.length}`}
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="contact-list-title" className="space-y-3">
        <h2 id="contact-list-title" className="sr-only">Contact list</h2>
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search name, email, phone, company or notes" aria-label="Search contacts" className="px-9" />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:flex">
            <div className="lg:w-40">
              <Select value={category} onValueChange={(v) => { setCategory(v as typeof category); setShown(PAGE); }}>
                <SelectTrigger aria-label="Filter by category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CONTACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:w-52">
              <Select value={quick} onValueChange={(v) => { setQuick(v as Quick); setShown(PAGE); }}>
                <SelectTrigger aria-label="Filter by data quality"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(QUICK_LABEL) as Quick[]).map((k) => <SelectItem key={k} value={k}>{titleCase(QUICK_LABEL[k])}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:w-56">
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger aria-label="Sort contacts"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>Sort: {titleCase(SORT_LABEL[k])}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {selected.size > 0 ? (
          <div role="toolbar" aria-label="Actions for selected contacts" className="flex flex-wrap items-center gap-2 rounded-xl border bg-accent/40 px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <div className="w-40">
              <Select value="" onValueChange={(v) => {
                commit(contacts.map((c) => (selected.has(c.id) ? { ...c, category: v as ContactCategory } : c)), `${selected.size} contact${selected.size === 1 ? "" : "s"} set to ${v}.`);
                setSelected(new Set());
              }}>
                <SelectTrigger aria-label="Set category for selected" className="h-8"><SelectValue placeholder="Set category…" /></SelectTrigger>
                <SelectContent>{CONTACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedContacts.length === 2 && (
              <Button size="sm" variant="outline" onClick={() => setMerging([selectedContacts[0], selectedContacts[1]])}><GitMerge /> Merge the two</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDeleting(selectedContacts)}><Trash2 /> Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="result-count">
            {filtered ? `Showing ${visible.length} of ${contacts.length} contacts.` : `${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`}
            {filtered && <> <button type="button" onClick={clearFilters} className="font-medium text-primary underline-offset-2 hover:underline">Clear filters</button></>}
          </p>
        )}

        {visible.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            <p>{contacts.length === 0 ? "No contacts yet. Add one or import a CSV." : "No contacts match these filters."}</p>
            {contacts.length === 0
              ? <div className="flex justify-center gap-2"><Button onClick={() => setFormFor("new")}><Plus /> Add your first contact</Button><Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button></div>
              : <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-panel">
            <div aria-hidden className="hidden grid-cols-[1.5rem_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_7rem_7.5rem_5.5rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span /><span>Name</span><span>Company</span><span>Email</span><span>Phone</span><span>Last contact</span><span />
            </div>
            <label className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground md:hidden">
              <input type="checkbox" checked={allShownSelected} onChange={() => setSelected(allShownSelected ? new Set() : new Set(visible.map((c) => c.id)))} className="size-4 accent-primary" /> Select all {visible.length}
            </label>
            <ul className="divide-y">
              {rows.map((c) => {
                const stale = isStale(c, today);
                const ago = c.lastContacted ? daysBetween(c.lastContacted, today) : null;
                return (
                  <li key={c.id} data-testid="contact-row" className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[1.5rem_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_7rem_7.5rem_5.5rem]">
                    <input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="size-4 accent-primary" />
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(c.name)}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="truncate font-medium">{c.name}</p>
                          <Badge variant={CATEGORY_BADGE[c.category]}>{c.category}</Badge>
                        </div>
                        {c.notes && <p className="truncate text-xs text-muted-foreground" title={c.notes}>{c.notes}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center md:order-last">
                      <Button size="icon-sm" variant="ghost" className="size-10 md:size-8" aria-label={`Edit ${c.name}`} onClick={() => setFormFor(c)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" className="size-10 md:size-8" aria-label={`Delete ${c.name}`} onClick={() => setDeleting([c])}><Trash2 /></Button>
                    </div>
                    <p className="col-start-2 col-end-4 truncate text-sm text-muted-foreground md:col-auto md:text-foreground">{c.company || <span className="md:text-muted-foreground">—</span>}</p>
                    <p className="col-start-2 col-end-4 truncate text-sm md:col-auto">
                      {c.email ? <a href={`mailto:${c.email}`} className={`text-primary ${linkClass}`}>{c.email}</a> : <span className="text-muted-foreground">No email</span>}
                    </p>
                    <p className="col-start-2 col-end-4 truncate text-sm md:col-auto">
                      {c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className={`text-primary ${linkClass}`}>{c.phone}</a> : <span className="text-muted-foreground">No phone</span>}
                    </p>
                    <p className={`col-start-2 col-end-4 text-xs md:col-auto ${stale ? "text-amber-700" : "text-muted-foreground"}`} title={c.lastContacted ? formatDayShort(c.lastContacted) : undefined}>
                      {ago === null ? "Never contacted" : ago <= 0 ? "Contacted today" : `${ago} day${ago === 1 ? "" : "s"} ago`}
                      {" "}
                      <button
                        type="button"
                        aria-label={`Mark ${c.name} contacted today`}
                        disabled={c.lastContacted === today}
                        onClick={() => commit(contacts.map((x) => (x.id === c.id ? { ...x, lastContacted: today } : x)), `${c.name} marked contacted today.`)}
                        className="rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hidden"
                      >
                        Log today
                      </button>
                    </p>
                  </li>
                );
              })}
            </ul>
            {visible.length > rows.length && (
              <div className="border-t p-3 text-center">
                <Button variant="outline" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, visible.length - rows.length)} more ({visible.length - rows.length} left)</Button>
              </div>
            )}
          </div>
        )}
      </section>

      <ContactFormDialog open={formFor !== null} contact={formFor && formFor !== "new" ? formFor : undefined} existing={contacts} today={today} onOpenChange={(o) => !o && setFormFor(null)} onSave={saveContact} />
      <ImportDialog open={importing} existing={contacts} onOpenChange={setImporting} onImport={runApply} />
      <MergeDialog pair={merging} onOpenChange={(o) => !o && setMerging(null)} onMerge={doMerge} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>{deleting && deleting.length > 1 ? `Delete ${deleting.length} contacts?` : "Delete contact?"}</DialogTitle>
          <DialogDescription className="mt-1">
            {deleting && deleting.length === 1 ? `${deleting[0].name} will be removed.` : `${deleting?.length ?? 0} selected contacts will be removed.`} You can undo this right after.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  const ids = new Set(deleting.map((c) => c.id));
                  commit(contacts.filter((c) => !ids.has(c.id)), deleting.length === 1 ? `${deleting[0].name} deleted.` : `${deleting.length} contacts deleted.`);
                  setSelected(new Set());
                }
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
