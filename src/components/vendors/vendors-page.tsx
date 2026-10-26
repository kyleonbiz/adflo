"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, FileWarning, Plus, Search, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import {
  VENDOR_APPROVER, decide, defaultRequirements, duplicatePairs, needsAttention, reopen, setActive, submitForApproval,
  summarize, vendorsToCsv,
} from "@/lib/vendors/logic";
import { e2eSeed } from "@/lib/e2e-seed";
import type { Vendor, VendorStatus } from "@/lib/vendors/types";
import type { VendorFormValues } from "@/lib/vendors/validation";
import { SEVERITY_BADGE, STATUS_LABEL } from "./status";
import { VendorCard, type VendorActions } from "./vendor-card";
import { VendorFormDialog } from "./vendor-form-dialog";

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
 * Vendor administration. Vendors live in this component's state (starting empty) until the
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

  const vendors = useMemo(() => edited ?? e2eSeed<Vendor>("vendors") ?? [], [edited]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const update = (fn: (all: Vendor[]) => Vendor[]) => setEdited(fn(vendors));
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
      patch(v.id, (x) => ({ ...x, documents: x.documents.map((y) => (y.id === d.id ? { ...y, ...dates } : y)) }));
    },
    onAddDocument: (v, type, required) =>
      patch(v.id, (x) => ({ ...x, documents: [...x.documents, { id: rid("vd"), type, required, receivedOn: null, expiresOn: null }] })),
    onRemoveDocument: (v, d) => patch(v.id, (x) => ({ ...x, documents: x.documents.filter((y) => y.id !== d.id) })),
  };

  const saveForm = (values: VendorFormValues) => {
    if (formFor && formFor !== "new") {
      patch(formFor.id, (x) => ({ ...x, ...values }));
      setNotice(`${values.name} updated.`);
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

  const summary = summarize(vendors, today);
  const attention = needsAttention(vendors, today);
  const pairs = duplicatePairs(vendors);
  const q = query.trim().toLowerCase();
  const visible = vendors
    .filter((v) => statusFilter === "all" || v.status === statusFilter)
    .filter((v) => !q || [v.name, v.contactName, v.email, v.category].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

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
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={Store} label="Vendors" value={summary.vendors} tone="text-primary" />
        <SummaryTile icon={CheckCircle2} label="Awaiting approval" value={summary.pendingApproval} tone="text-amber-600" />
        <SummaryTile icon={FileWarning} label="Document issues" value={summary.documentIssues} tone="text-red-600" />
        <SummaryTile icon={Copy} label="Possible duplicates" value={summary.duplicatePairs} tone="text-sky-600" />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="vendor-attention" className="rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="vendor-attention" className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="size-4 text-amber-600" aria-hidden /> Needs attention</h2>
          {attention.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No expired or expiring documents.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {attention.map(({ vendor, alert }) => (
                <li key={vendor.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{vendor.name}</span>
                  <Badge variant={SEVERITY_BADGE[alert.severity]}>{alert.message}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="vendor-duplicates" className="rounded-2xl border bg-card p-4 shadow-panel">
          <h2 id="vendor-duplicates" className="flex items-center gap-2 text-base font-semibold"><Copy className="size-4 text-sky-600" aria-hidden /> Possible duplicates</h2>
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

      <section aria-label="Vendors" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, contact, email or category" aria-label="Search vendors" className="pl-9" />
          </div>
          <div className="sm:w-52">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as VendorStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {vendors.length === 0 ? "No vendors yet. Add your first one." : "No vendors match these filters."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((v) => <VendorCard key={v.id} vendor={v} today={today} actions={actions} />)}
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
