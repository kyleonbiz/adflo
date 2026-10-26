"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, FileWarning, Plus, Search, Store, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import {
  VENDOR_APPROVER, decide, defaultRequirements, duplicatePairs, hasDocumentIssues, needsAttention, reopen, setActive,
  submitForApproval, summarize, vendorsToCsv,
} from "@/lib/vendors/logic";
import { sampleVendors } from "@/lib/vendors/sample-data";
import type { Vendor, VendorStatus } from "@/lib/vendors/types";
import type { VendorFormValues } from "@/lib/vendors/validation";
import { SEVERITY_BADGE, STATUS_LABEL } from "./status";
import { VendorCard, type VendorActions } from "./vendor-card";
import { VendorFormDialog } from "./vendor-form-dialog";
import { titleCase } from "@/lib/text";

type SortKey = "name" | "status" | "newest";
const STATUS_ORDER: VendorStatus[] = ["pending_approval", "onboarding", "approved", "inactive", "rejected"];
const SORT_LABEL: Record<SortKey, string> = { name: "Name", status: "Status", newest: "Newest first" };

const rid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function downloadCsv(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Vendor administration. Vendors live in this component's state (seeded with sample data) until the
 * database is connected, so nothing here is saved between visits and no notifications are sent.
 */
export function VendorsPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [edited, setEdited] = useState<Vendor[] | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VendorStatus>("all");
  const [formFor, setFormFor] = useState<Vendor | "new" | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  const seed = useMemo(() => (today ? sampleVendors(today) : []), [today]);
  const vendors = edited ?? seed;
  const summary = useMemo(() => (today ? summarize(vendors, today) : null), [vendors, today]);
  const attention = useMemo(() => (today ? needsAttention(vendors, today) : []), [vendors, today]);
  const pairs = useMemo(() => duplicatePairs(vendors), [vendors]);

  // Action results stay visible long enough to read, then clear.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!today || !summary) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const update = (fn: (all: Vendor[]) => Vendor[]) => setEdited((prev) => fn(prev ?? seed));
  const patch = (id: string, change: (v: Vendor) => Vendor) => update((all) => all.map((v) => (v.id === id ? change(v) : v)));

  const actions: VendorActions = {
    onEdit: (v) => setFormFor(v),
    onDelete: (v) => setDeleting(v),
    onSubmit: (v) => { patch(v.id, (x) => submitForApproval(x, today)); setNotice(`${v.name} submitted for approval.`); },
    onDecide: (v, decision, comment) => { patch(v.id, (x) => decide(x, decision, VENDOR_APPROVER, today, comment)); setNotice(`${v.name} ${decision}.`); },
    onReopen: (v) => { patch(v.id, reopen); setNotice(`${v.name} reopened for onboarding.`); },
    onActive: (v, active) => { patch(v.id, (x) => setActive(x, active)); setNotice(`${v.name} ${active ? "reactivated" : "deactivated"}.`); },
    onSetDocument: (v, d, dates) => {
      if (dates.receivedOn && dates.expiresOn && dates.expiresOn < dates.receivedOn) {
        setNotice("The expiry date cannot be before the received date.");
        return;
      }
      if (dates.receivedOn && dates.receivedOn > today) {
        setNotice("The received date cannot be in the future.");
        return;
      }
      patch(v.id, (x) => ({ ...x, documents: x.documents.map((y) => (y.id === d.id ? { ...y, ...dates } : y)) }));
    },
    onAddDocument: (v, type, required) =>
      patch(v.id, (x) => ({ ...x, documents: [...x.documents, { id: rid("vd"), type, required, receivedOn: null, expiresOn: null }] })),
    onRemoveDocument: (v, d) => patch(v.id, (x) => ({ ...x, documents: x.documents.filter((y) => y.id !== d.id) })),
  };

  const saveForm = (values: VendorFormValues) => {
    if (formFor && formFor !== "new") {
      // A new category brings its standard documents; ones the vendor already has are kept as they are.
      const current = formFor;
      const have = new Set(current.documents.map((d) => d.type));
      const extra = current.category === values.category ? [] : defaultRequirements(values.category)
        .filter((r) => !have.has(r.type))
        .map((r) => ({ id: rid("vd"), type: r.type, required: true, receivedOn: null, expiresOn: null }));
      patch(current.id, (x) => ({ ...x, ...values, documents: [...x.documents, ...extra] }));
      setNotice(extra.length > 0 ? `${values.name} updated. ${extra.length} required document${extra.length === 1 ? "" : "s"} added for ${values.category}.` : `${values.name} updated.`);
      return;
    }
    const documents = defaultRequirements(values.category).map((r) => ({
      id: rid("vd"), type: r.type, required: true, receivedOn: null, expiresOn: null,
    }));
    update((all) => [...all, {
      ...values, id: rid("v"), status: "onboarding", createdOn: today, documents, decidedBy: null, decidedOn: null, comment: "",
    }]);
    setNotice(`${values.name} added. Collect its ${documents.length} required documents to submit it for approval.`);
  };

  const q = query.trim().toLowerCase();
  const filtered = statusFilter !== "all" || issuesOnly || q !== "";
  const clearFilters = () => { setQuery(""); setStatusFilter("all"); setIssuesOnly(false); };
  const showVendor = (id: string) => {
    // The card might be filtered out; clear filters so it can be found, then open its documents.
    clearFilters();
    setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  };
  const visible = vendors
    .filter((v) => statusFilter === "all" || v.status === statusFilter)
    .filter((v) => !issuesOnly || hasDocumentIssues(v, today))
    .filter((v) => !q || [v.name, v.contactName, v.email, v.category].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === "status" ? STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name)
      : sort === "newest" ? b.createdOn.localeCompare(a.createdOn) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">Onboard suppliers, collect their documents and catch expiries and duplicates.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={visible.length === 0} onClick={() => downloadCsv(vendorsToCsv(visible, today), `vendors-${today}.csv`)}>
            <Download /> Export CSV
          </Button>
          <Button onClick={() => setFormFor("new")}><Plus /> Add vendor</Button>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <div role="status" aria-live="polite" className={notice ? "sticky top-2 z-20 flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm shadow-float" : "sr-only"}>
        <span>{notice}</span>
        {notice && (
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")} className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={Store} label="Vendors" value={summary.vendors} tone="text-primary" onClick={clearFilters} />
        <SummaryTile icon={CheckCircle2} label="Awaiting approval" value={summary.pendingApproval} tone="text-amber-600" pressed={statusFilter === "pending_approval"}
          onClick={() => { setIssuesOnly(false); setStatusFilter("pending_approval"); }} />
        <SummaryTile icon={FileWarning} label="Document issues" value={summary.documentIssues} tone="text-red-600" pressed={issuesOnly}
          onClick={() => { setStatusFilter("all"); setIssuesOnly(true); }} />
        <SummaryTile icon={Copy} label="Possible duplicates" value={summary.duplicatePairs} tone="text-sky-600" href="#vendor-duplicates" />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="vendor-attention" className="rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="vendor-attention" className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="size-4 text-amber-600" aria-hidden /> Needs attention</h2>
          {attention.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No expired or expiring documents.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {attention.map(({ vendor, alert, more }) => (
                <li key={vendor.id}>
                  <button
                    type="button"
                    onClick={() => showVendor(vendor.id)}
                    aria-label={`Open ${vendor.name} documents`}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{vendor.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={SEVERITY_BADGE[alert.severity]}>{alert.message}</Badge>
                      {more > 0 && <span className="text-xs text-muted-foreground">+{more} more</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="vendor-duplicates" aria-labelledby="vendor-duplicates-title" className="scroll-mt-4 rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="vendor-duplicates-title" className="flex items-center gap-2 text-base font-semibold"><Copy className="size-4 text-sky-600" aria-hidden /> Possible duplicates</h2>
          {pairs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No matching vendors found.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {pairs.map((p) => (
                <li key={`${p.a.id}-${p.b.id}`} className="py-2 text-sm" data-testid="duplicate-pair">
                  <p><span className="font-medium">{p.a.name}</span> and <span className="font-medium">{p.b.name}</span></p>
                  <p className="text-xs text-muted-foreground">{p.reasons.join(", ")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="vendor-list-title" className="space-y-3">
        <h2 id="vendor-list-title" className="sr-only">Vendor list</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, contact, email or category" aria-label="Search vendors" className="px-9" />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="sm:w-44">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger aria-label="Sort vendors"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>Sort: {titleCase(SORT_LABEL[k])}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-52">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as VendorStatus[]).map((s) => <SelectItem key={s} value={s}>{titleCase(STATUS_LABEL[s])}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {issuesOnly && (
          <p className="text-sm text-muted-foreground">Showing vendors with expiring or expired documents. <button type="button" onClick={() => setIssuesOnly(false)} className="font-medium text-primary underline-offset-2 hover:underline">Show all</button></p>
        )}
        {visible.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            <p>{vendors.length === 0 ? "No vendors yet." : "No vendors match these filters."}</p>
            {vendors.length === 0 ? <Button onClick={() => setFormFor("new")}><Plus /> Add your first vendor</Button>
              : filtered && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((v) => <VendorCard key={v.id} vendor={v} today={today} actions={actions} focusKey={focus?.id === v.id ? focus.n : undefined} />)}
          </ul>
        )}
      </section>

      <VendorFormDialog
        open={formFor !== null}
        vendor={formFor && formFor !== "new" ? formFor : undefined}
        existing={vendors}
        onOpenChange={(o) => !o && setFormFor(null)}
        onSubmit={saveForm}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete vendor?</DialogTitle>
          <DialogDescription className="mt-1">{deleting?.name} and its document records will be removed. Deactivate it instead to keep the history.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  update((all) => all.filter((v) => v.id !== deleting.id));
                  setNotice(`${deleting.name} deleted.`);
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
