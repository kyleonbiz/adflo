"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, Plus, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { e2eSeed } from "@/lib/e2e-seed";
import {
  formatMoney, describeItems, groupInvoices, hasNextInvoice, invoiceTotals, paymentDateError, reopen, voidInvoice, invoicesToCsv, invoiceState, markPaid, markSent,   nextRecurringInvoice, summarize,
} from "@/lib/invoices/logic";
import { invoiceMailto, invoicePath } from "@/lib/invoices/share";
import type { Invoice, InvoiceState } from "@/lib/invoices/types";
import type { InvoiceFormValues } from "@/lib/invoices/validation";
import { InvoiceCard, type InvoiceActions } from "./invoice-card";
import { InvoiceFormDialog } from "./invoice-form-dialog";
import { InvoicePreview } from "./invoice-preview";
import { titleCase } from "@/lib/text";

/** "sent" matches every sent invoice however close to due; the rest match one state. */
type StatusFilter = "all" | "sent" | Exclude<InvoiceState, "upcoming">;
const FILTERS: StatusFilter[] = ["draft", "sent", "due_soon", "due_today", "overdue", "paid", "void"];
const FILTER_LABEL: Record<StatusFilter, string> = { all: "All statuses", sent: "Sent (unpaid)", draft: "Draft", due_soon: "Due soon", due_today: "Due today", overdue: "Overdue", paid: "Paid", void: "Void" };
const matchesFilter = (i: Invoice, f: StatusFilter, today: string) =>
  f === "all" || (f === "sent" ? i.status === "sent" : invoiceState(i, today) === f);

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
 * Invoice administration. Records live in this component's state (starting empty) until the
 * database is connected, so nothing here is saved between visits and no reminder emails are sent.
 */
export function InvoicesPage({ preview, startNew }: { preview?: string; startNew?: boolean }) {
  const today = useToday();
  const [edited, setEdited] = useState<Invoice[] | null>(null);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StatusFilter>("all");
  const [formFor, setFormFor] = useState<Invoice | "new" | null>(startNew ? "new" : null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payDate, setPayDate] = useState("");
  const [notice, setNotice] = useState("");

  const invoices = useMemo(() => edited ?? e2eSeed<Invoice>("invoices") ?? [], [edited]);

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
    onView: (i) => setViewing(i),
    onEdit: (i) => setFormFor(i),
    onDelete: (i) => setDeleting(i),
    onSend: (i) => { patch(i.id, markSent); setNotice(`${i.number} marked as sent.`); },
    onPay: (i) => { setPayDate(today); setPaying(i); },
    onVoid: (i) => setVoiding(i),
    onReopen: (i) => {
      patch(i.id, reopen);
      setNotice(i.status === "void" ? `${i.number} reopened as a draft.` : `${i.number} payment undone.`);
    },
    onEmail: (i) => {
      window.location.href = invoiceMailto(i, window.location.origin);
      if (i.status === "draft") patch(i.id, markSent);
      setNotice(`Opened your email app for ${i.number}${i.clientEmail ? ` to ${i.clientEmail}` : ""}${i.status === "draft" ? "; marked as sent." : "."}`);
    },
    onCopyLink: async (i) => {
      const link = `${window.location.origin}${invoicePath(i)}`;
      try { await navigator.clipboard.writeText(link); setNotice(`Link to ${i.number} copied.`); }
      catch { setNotice(`Copy this link to ${i.number}: ${link}`); }
    },
    onNext: (i) => {
      if (hasNextInvoice(i, invoices)) { setNotice(`The next invoice after ${i.number} already exists.`); return; }
      const next = nextRecurringInvoice(i, invoices, newId());
      if (!next) return;
      update((all) => [...all, next]);
      setNotice(`Draft ${next.number} created for ${formatDayLong(next.issuedOn)}.`);
    },
  };

  const saveForm = (values: InvoiceFormValues) => {
    const items = values.items.map((i) => ({ description: i.description, qty: i.qty, rateCents: i.rate }));
    const fields = {
      number: values.number, client: values.client, clientEmail: values.clientEmail,
      items, taxRate: values.taxRate, description: describeItems(items), amountCents: invoiceTotals(items, values.taxRate).totalCents,
      sender: { name: values.fromName, address: values.fromAddress, phone: values.fromPhone, email: values.fromEmail },
      paymentMethods: values.paymentMethods, issuedOn: values.issuedOn, dueOn: values.dueOn,
      recurrence: values.recurrence as Invoice["recurrence"], reminderDays: values.reminderDays, notes: values.notes,
    };
    if (formFor && formFor !== "new") {
      const updated = { ...formFor, ...fields };
      patch(formFor.id, () => updated);
      setNotice(`${values.number} updated.`);
    } else {
      const created: Invoice = { ...fields, id: newId(), status: "draft", paidOn: null };
      update((all) => [...all, created]);
      setViewing(created);
      setNotice(`${values.number} created as a draft.`);
    }
  };

  const payError = paying ? paymentDateError(paying, payDate, today) : null;
  const summary = summarize(invoices, today);
  const q = query.trim().toLowerCase();
  const visible = invoices
    .filter((i) => matchesFilter(i, stateFilter, today))
    .filter((i) => !q || [i.number, i.client, i.description].some((f) => f.toLowerCase().includes(q)))
;
  const groups = groupInvoices(visible, today);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Track what is owed, repeat recurring invoices and chase overdue payments.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadCsv(invoicesToCsv(groups.flatMap((g) => g.invoices), today), `invoice-report-${today}.csv`)}
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
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {FILTERS.map((s) => <SelectItem key={s} value={s}>{titleCase(FILTER_LABEL[s])}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {invoices.length === 0 ? "No invoices yet. Create your first one." : "No invoices match these filters."}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key} role="group" aria-labelledby={`group-${g.key}`}>
                <h2 id={`group-${g.key}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {g.label} <span className="font-normal text-muted-foreground">{g.invoices.length}</span>
                </h2>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-panel">
                  {g.invoices.map((i) => <InvoiceCard key={i.id} invoice={i} today={today} actions={actions} />)}
                </ul>
              </div>
            ))}
          </div>
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

      <InvoicePreview invoice={viewing} today={today} onOpenChange={(o) => !o && setViewing(null)} onEdit={(i) => setFormFor(i)} />

      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Void invoice?</DialogTitle>
          <DialogDescription className="mt-1">
            {voiding?.number} for {voiding?.client} will stop counting as owed. You can reopen it later.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoiding(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (voiding) {
                  patch(voiding.id, voidInvoice);
                  setNotice(`${voiding.number} voided.`);
                }
                setVoiding(null);
              }}
            >
              Void
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription className="mt-1">When did {paying?.client} pay {paying?.number}?</DialogDescription>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="pay-date">Payment Date</Label>
            <Input
              id="pay-date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              aria-invalid={!!payError}
              aria-describedby={payError ? "pay-date-error" : undefined}
            />
            {payError && <p id="pay-date-error" role="alert" className="text-xs text-destructive">{payError}</p>}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
            <Button
              disabled={!!payError}
              onClick={() => {
                if (paying && !payError) {
                  patch(paying.id, (x) => markPaid(x, payDate));
                  setNotice(`${paying.number} marked as paid.`);
                  setPaying(null);
                }
              }}
            >
              Mark paid
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
