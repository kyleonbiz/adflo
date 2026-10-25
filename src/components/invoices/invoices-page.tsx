"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, Plus, Receipt, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import {
  formatMoney, invoiceAlerts, invoicesToCsv, invoiceState, markPaid, markSent, needsAttention,
  nextRecurringInvoice, summarize,
} from "@/lib/invoices/logic";
import { sampleInvoices } from "@/lib/invoices/sample-data";
import type { Invoice, InvoiceState } from "@/lib/invoices/types";
import type { InvoiceFormValues } from "@/lib/invoices/validation";
import { InvoiceCard, type InvoiceActions } from "./invoice-card";
import { InvoiceFormDialog } from "./invoice-form-dialog";
import { SEVERITY_BADGE, STATE_LABEL } from "./status";

const newId = () => `inv-${Math.random().toString(36).slice(2, 10)}`;

function downloadCsv(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Invoice administration. Records live in this component's state (seeded with sample data) until the
 * database is connected, so nothing here is saved between visits and no reminder emails are sent.
 */
export function InvoicesPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [edited, setEdited] = useState<Invoice[] | null>(null);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | InvoiceState>("all");
  const [formFor, setFormFor] = useState<Invoice | "new" | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [notice, setNotice] = useState("");

  const invoices = useMemo(() => edited ?? (today ? sampleInvoices(today) : []), [edited, today]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const update = (fn: (all: Invoice[]) => Invoice[]) => setEdited(fn(invoices));
  const patch = (id: string, change: (i: Invoice) => Invoice) => update((all) => all.map((i) => (i.id === id ? change(i) : i)));

  const actions: InvoiceActions = {
    onEdit: (i) => setFormFor(i),
    onDelete: (i) => setDeleting(i),
    onSend: (i) => { patch(i.id, markSent); setNotice(`${i.number} marked as sent.`); },
    onPay: (i) => { patch(i.id, (x) => markPaid(x, today)); setNotice(`${i.number} marked as paid.`); },
    onVoid: (i) => { patch(i.id, (x) => ({ ...x, status: "void" })); setNotice(`${i.number} voided.`); },
    onNext: (i) => {
      const next = nextRecurringInvoice(i, invoices, newId());
      if (!next) return;
      update((all) => [...all, next]);
      setNotice(`Draft ${next.number} created for ${formatDayLong(next.issuedOn)}.`);
    },
  };

  const saveForm = (values: InvoiceFormValues) => {
    const { amount, recurrence, ...rest } = values;
    const fields = { ...rest, recurrence: recurrence as Invoice["recurrence"], amountCents: amount };
    if (formFor && formFor !== "new") {
      patch(formFor.id, (x) => ({ ...x, ...fields }));
      setNotice(`${values.number} updated.`);
    } else {
      update((all) => [...all, { ...fields, id: newId(), status: "draft", paidOn: null }]);
      setNotice(`${values.number} created as a draft.`);
    }
  };

  const summary = summarize(invoices, today);
  const attention = needsAttention(invoices, today);
  const q = query.trim().toLowerCase();
  const visible = invoices
    .filter((i) => stateFilter === "all" || invoiceState(i, today) === stateFilter)
    .filter((i) => !q || [i.number, i.client, i.description].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => (a.dueOn < b.dueOn ? 1 : a.dueOn > b.dueOn ? -1 : 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Module 02</p>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Track what is owed, repeat recurring invoices and chase overdue payments.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadCsv(invoicesToCsv(visible, today), `invoice-report-${today}.csv`)}
            disabled={visible.length === 0}
          >
            <Download /> Export CSV
          </Button>
          <Button onClick={() => setFormFor("new")}><Plus /> New invoice</Button>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={Receipt} label="Outstanding" value={formatMoney(summary.outstandingCents)} tone="text-primary" />
        <SummaryTile icon={AlertTriangle} label={`Overdue (${summary.overdueCount})`} value={formatMoney(summary.overdueCents)} tone="text-red-600" />
        <SummaryTile icon={CalendarClock} label="Due in 7 days" value={summary.dueSoonCount} tone="text-amber-600" />
        <SummaryTile icon={CheckCircle2} label="Paid this month" value={formatMoney(summary.paidThisMonthCents)} tone="text-emerald-600" />
      </section>

      <section aria-labelledby="attention-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h2 id="attention-heading" className="text-base font-semibold">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing overdue or due this week.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {attention.map((i) => {
              const alert = invoiceAlerts(i, today)[0];
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><span className="font-medium">{i.number}</span> · {i.client}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">{formatMoney(i.amountCents)}</span>
                    {alert && <Badge variant={SEVERITY_BADGE[alert.severity]}>{alert.message}</Badge>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Invoices" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search number, client or description"
              aria-label="Search invoices"
              className="pl-9"
            />
          </div>
          <div className="sm:w-52">
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as typeof stateFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATE_LABEL) as InvoiceState[]).map((s) => <SelectItem key={s} value={s}>{STATE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {invoices.length === 0 ? "No invoices yet. Create your first one." : "No invoices match these filters."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((i) => <InvoiceCard key={i.id} invoice={i} today={today} actions={actions} />)}
          </ul>
        )}
      </section>

      <InvoiceFormDialog
        open={formFor !== null}
        invoice={formFor && formFor !== "new" ? formFor : undefined}
        existing={invoices}
        today={today}
        onOpenChange={(o) => !o && setFormFor(null)}
        onSubmit={saveForm}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete invoice?</DialogTitle>
          <DialogDescription className="mt-1">
            {deleting?.number} for {deleting?.client} will be removed. Void it instead to keep the record.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  update((all) => all.filter((i) => i.id !== deleting.id));
                  setNotice(`${deleting.number} deleted.`);
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
