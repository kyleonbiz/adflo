"use client";

import { BulkBar, useSelection } from "@/components/ui/bulk-bar";
import { readParam, useUrlFilters } from "@/lib/url-filters";
import { PreviewNote } from "@/components/ui/preview-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, Plus, Receipt, Search } from "lucide-react";
import { useAudit } from "@/components/audit/use-audit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/modules/empty-state";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { e2eSeed } from "@/lib/e2e-seed";
import {
  arrangeInvoices, formatMoney, describeItems, type InvoiceGroupBy, type InvoiceSort, hasNextInvoice, invoiceTotals, paymentDateError, reopen, voidInvoice, invoicesToCsv, invoiceState, markPaid, markSent,   nextRecurringInvoice, summarize,
} from "@/lib/invoices/logic";
import { chaseEmail } from "@/lib/invoices/chase";
import { invoiceMailto, invoicePath } from "@/lib/invoices/share";
import { mailtoLink } from "@/lib/vendors/follow-up";
import type { Invoice, InvoiceState } from "@/lib/invoices/types";
import type { InvoiceFormValues } from "@/lib/invoices/validation";
import { InvoiceCard, type InvoiceActions } from "./invoice-card";
import { InvoiceFormDialog, type BillableClient, type InvoiceDraft, type SenderDefaults } from "./invoice-form-dialog";
import { InvoicePreview } from "./invoice-preview";
import { useRecordsLoading, useRecordsState } from "@/lib/records/storage";
import { publicOrigin } from "@/lib/public-origin";

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
 * Invoice administration in the client app. Records come from the workspace's saved invoices (the browser, or the
 * database when one is connected).
 */
export function InvoicesPage({ preview, startNew, draft, initialQuery = "" }: { preview?: string; startNew?: boolean; draft?: InvoiceDraft; initialQuery?: string }) {
  const loading = useRecordsLoading(); // saved invoices are still arriving from the database
  const audit = useAudit();
  const [edited, setEdited] = useRecordsState<Invoice>("invoices");
  const invoices = useMemo(() => edited ?? e2eSeed<Invoice>("invoices") ?? [], [edited]);
  return (
    <InvoicesView
      invoices={invoices} loading={loading} onChange={setEdited} audit={(verb, what) => audit(verb, what, "Invoices", "/app/invoices")}
      preview={preview} startNew={startNew} draft={draft} initialQuery={initialQuery}
    />
  );
}

export interface InvoicesViewProps {
  invoices: Invoice[];
  loading?: boolean;
  /** Called with the whole new list whenever anything changes. */
  onChange: (next: Invoice[]) => void;
  audit: (verb: string, what: string) => void;
  preview?: string;
  startNew?: boolean;
  draft?: InvoiceDraft;
  initialQuery?: string;
  /** Control center: the clients invoices can be addressed to, "From" details and where they are remembered. */
  clients?: BillableClient[];
  draftClientId?: string;
  senderKey?: string;
  senderDefaults?: SenderDefaults;
  /** Extra buttons beside "New invoice". */
  headerActions?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/** The invoice screen itself: create, view, download, send, chase and mark paid. It does not care where the list is kept. */
export function InvoicesView({
  invoices, loading = false, onChange, audit, preview, startNew, draft, initialQuery = "", clients, draftClientId, senderKey, senderDefaults, headerActions,
  title = "Invoices", subtitle = "Track what is owed, repeat recurring invoices and chase overdue payments.",
}: InvoicesViewProps) {
  const today = useToday();
  const [query, setQuery] = useState(() => initialQuery || readParam("q", ""));
  const [stateFilter, setStateFilter] = useState<StatusFilter>(() => readParam<StatusFilter>("status", "all", ["all", "sent", ...FILTERS]));
  const [formFor, setFormFor] = useState<Invoice | "new" | null>(startNew ? "new" : null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payDate, setPayDate] = useState("");
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<InvoiceSort | "default">(() => readParam<InvoiceSort | "default">("sort", "default", ["default", "due", "amount", "client", "number"]));
  const [groupBy, setGroupBy] = useState<InvoiceGroupBy>(() => readParam<InvoiceGroupBy>("group", "status", ["status", "client", "month"]));
  useUrlFilters({ q: query, status: stateFilter, sort, group: groupBy }, { status: "all", sort: "default", group: "status" });
  const [bulkDelete, setBulkDelete] = useState(false);
  const [undoer, setUndoer] = useState<{ text: string; run: () => void } | null>(null);
  const sel = useSelection();

  if (!today || loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const update = (fn: (all: Invoice[]) => Invoice[]) => onChange(fn(invoices));
  const patch = (id: string, change: (i: Invoice) => Invoice) => update((all) => all.map((i) => (i.id === id ? change(i) : i)));

  const actions: InvoiceActions = {
    onView: (i) => setViewing(i),
    onEdit: (i) => setFormFor(i),
    onDelete: (i) => setDeleting(i),
    onSend: (i) => { patch(i.id, markSent); audit("marked as sent", `invoice ${i.number}`); setNotice(`${i.number} marked as sent.`); },
    onPay: (i) => { setPayDate(today); setPaying(i); },
    onVoid: (i) => setVoiding(i),
    onReopen: (i) => {
      patch(i.id, reopen);
      setNotice(i.status === "void" ? `${i.number} reopened as a draft.` : `${i.number} payment undone.`);
    },
    onEmail: (i) => {
      window.location.href = invoiceMailto(i, publicOrigin());
      if (i.status === "draft") patch(i.id, markSent);
      audit("emailed", `invoice ${i.number}`);
      setNotice(`Opened your email app for ${i.number}${i.clientEmail ? ` to ${i.clientEmail}` : ""}${i.status === "draft" ? "; marked as sent." : "."}`);
    },
    onChase: (i) => {
      const mail = chaseEmail(i, today);
      window.location.href = mailtoLink(mail);
      audit("sent a payment reminder for", `invoice ${i.number}`);
      setNotice(`Opened your email app with a payment reminder for ${i.number}${i.clientEmail ? ` to ${i.clientEmail}` : ""}.`);
    },
    onCopyLink: async (i) => {
      const link = `${publicOrigin()}${invoicePath(i)}`;
      try { await navigator.clipboard.writeText(link); setNotice(`Link to ${i.number} copied.`); }
      catch { setNotice(`Copy this link to ${i.number}: ${link}`); }
    },
    onNext: (i) => {
      if (hasNextInvoice(i, invoices)) { setNotice(`The next invoice after ${i.number} already exists.`); return; }
      const next = nextRecurringInvoice(i, invoices, newId());
      if (!next) return;
      update((all) => [...all, next]);
      audit("created", `invoice ${next.number} as the next in the series`);
      setNotice(`Draft ${next.number} created for ${formatDayLong(next.issuedOn)}.`);
    },
  };

  const saveForm = (values: InvoiceFormValues, clientId?: string) => {
    const items = values.items.map((i) => ({ description: i.description, qty: i.qty, rateCents: i.rate }));
    const fields = {
      number: values.number, client: values.client, clientEmail: values.clientEmail, ...(clients ? { clientId } : {}),
      items, taxRate: values.taxRate, description: describeItems(items), amountCents: invoiceTotals(items, values.taxRate).totalCents,
      sender: { name: values.fromName, address: values.fromAddress, phone: values.fromPhone, email: values.fromEmail },
      paymentMethods: values.paymentMethods, issuedOn: values.issuedOn, dueOn: values.dueOn,
      recurrence: values.recurrence as Invoice["recurrence"], reminderDays: values.reminderDays, notes: values.notes,
    };
    if (formFor && formFor !== "new") {
      const updated = { ...formFor, ...fields };
      patch(formFor.id, () => updated);
      audit("edited", `invoice ${values.number}`);
      setNotice(`${values.number} updated.`);
    } else {
      const created: Invoice = { ...fields, id: newId(), status: "draft", paidOn: null };
      update((all) => [...all, created]);
      setViewing(created);
      audit("created", `invoice ${values.number}`);
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
  const groups = arrangeInvoices(visible, today, groupBy, sort === "default" ? null : sort);
  const shownIds = groups.flatMap((g) => g.invoices.map((i) => i.id));
  const chosen = invoices.filter((i) => sel.has(i.id));
  const bulkPatch = (fn: (i: Invoice) => Invoice, verb: string, only: (i: Invoice) => boolean) => {
    const hit = chosen.filter(only);
    if (hit.length === 0) { setNotice("None of the selected invoices can be changed that way."); return; }
    const ids = new Set(hit.map((i) => i.id));
    update((all) => all.map((i) => (ids.has(i.id) ? fn(i) : i)));
    audit(verb, `${hit.length} invoice${hit.length === 1 ? "" : "s"}`);
    setNotice(`${hit.length} invoice${hit.length === 1 ? "" : "s"} ${verb}.`);
    sel.clear();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {headerActions}
          <Button
            variant="outline"
            onClick={() => downloadCsv(invoicesToCsv(groups.flatMap((g) => g.invoices), today), `invoice-report-${today}.csv`)}
            disabled={visible.length === 0}
          >
            <Download /> Export CSV ({visible.length})
          </Button>
          <Button onClick={() => setFormFor("new")}><Plus /> New invoice</Button>
        </div>
      </div>

      {preview && (
        <PreviewNote>{preview}</PreviewNote>
      )}
      <p role="status" aria-live="polite" className={notice ? "flex items-center gap-2 text-sm text-muted-foreground" : "sr-only"}>
        {notice}
        {notice && undoer?.text === notice && <Button size="sm" variant="outline" className="h-7" onClick={undoer.run}>Undo</Button>}
      </p>

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
          <div className="sm:w-40">
            <Select value={sort} onValueChange={(v) => setSort(v as InvoiceSort | "default")}>
              <SelectTrigger aria-label="Sort invoices"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Sort: urgency</SelectItem>
                <SelectItem value="due">Due date</SelectItem>
                <SelectItem value="amount">Amount, high to low</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="number">Invoice number</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-40">
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as InvoiceGroupBy)}>
              <SelectTrigger aria-label="Group invoices"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Group: status</SelectItem>
                <SelectItem value="client">Group: client</SelectItem>
                <SelectItem value="month">Group: due month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-52">
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {FILTERS.map((s) => <SelectItem key={s} value={s}>{FILTER_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <BulkBar count={sel.size} total={shownIds.length} onSelectAll={() => sel.set(shownIds)} onClear={sel.clear}>
          <Button size="sm" variant="outline" onClick={() => bulkPatch(markSent, "marked as sent", (i) => i.status === "draft")}>Mark sent</Button>
          <Button size="sm" variant="outline" onClick={() => bulkPatch((i) => markPaid(i, today), "marked as paid", (i) => i.status === "sent")}>Mark paid today</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(invoicesToCsv(chosen, today), `invoices-selected-${today}.csv`)}><Download /> Export</Button>
          <Button size="sm" variant="destructive" onClick={() => setBulkDelete(true)}>Delete</Button>
        </BulkBar>

        {visible.length === 0 ? (
          invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="Send your first invoice" description="Create an invoice, choose whether it repeats, and it stays open until you mark it paid." points={["One-time, weekly, monthly, quarterly or yearly", "Reminders before the due date and after it passes", "Download it or send it from your email"]}>
              <Button onClick={() => setFormFor("new")}><Plus /> New invoice</Button>
            </EmptyState>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">No invoices match these filters.</div>
          )
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key} role="group" aria-labelledby={`group-${g.key}`}>
                <h2 id={`group-${g.key}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {g.label} <span className="font-normal text-muted-foreground">{g.invoices.length}</span>
                </h2>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-panel">
                  {g.invoices.map((i) => <InvoiceCard key={i.id} invoice={i} today={today} actions={actions} selected={sel.has(i.id)} onSelect={() => sel.toggle(i.id)} />)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <InvoiceFormDialog
        open={formFor !== null}
        invoice={formFor && formFor !== "new" ? formFor : undefined}
        draft={draft}
        existing={invoices}
        today={today}
        onOpenChange={(o) => !o && setFormFor(null)}
        onSubmit={saveForm}
        clients={clients}
        draftClientId={draftClientId}
        senderKey={senderKey}
        senderDefaults={senderDefaults}
      />

      <InvoicePreview invoice={viewing} today={today} onOpenChange={(o) => !o && setViewing(null)} onEdit={(i) => setFormFor(i)} />

      <ConfirmDialog open={!!voiding} title="Void invoice?" description={<>
            {voiding?.number} for {voiding?.client} will stop counting as owed. You can reopen it later.
          </>} confirmLabel="Void" onCancel={() => setVoiding(null)} onConfirm={() => {
                if (voiding) {
                  patch(voiding.id, voidInvoice);
                  audit("voided", `invoice ${voiding.number}`);
                  setNotice(`${voiding.number} voided.`);
                }
                setVoiding(null);
        }} />

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription className="mt-1">When did {paying?.client} pay {paying?.number}?</DialogDescription>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="pay-date">Payment date</Label>
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
                  audit("marked as paid", `invoice ${paying.number}`);
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

      <ConfirmDialog
        open={bulkDelete} title={`Delete ${sel.size} invoice${sel.size === 1 ? "" : "s"}?`} confirmLabel="Delete"
        description="They will be removed. Void an invoice instead to keep its record."
        onCancel={() => setBulkDelete(false)}
        onConfirm={() => {
          const before = invoices;
          update((all) => all.filter((i) => !sel.has(i.id)));
          audit("deleted", `${sel.size} invoices`);
          setNotice(`${sel.size} invoices deleted.`);
          setUndoer({ text: `${sel.size} invoices deleted.`, run: () => { onChange(before); setNotice("Invoices restored."); } });
          sel.clear(); setBulkDelete(false);
        }}
      />
      <ConfirmDialog open={!!deleting} title="Delete invoice?" description={<>
            {deleting?.number} for {deleting?.client} will be removed. Void it instead to keep the record.
          </>} confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={() => {
                if (deleting) {
                  const before = invoices;
                  update((all) => all.filter((i) => i.id !== deleting.id));
                  audit("deleted", `invoice ${deleting.number}`);
                  setNotice(`${deleting.number} deleted.`);
                  setUndoer({ text: `${deleting.number} deleted.`, run: () => { onChange(before); setNotice(`${deleting.number} restored.`); } });
                }
                setDeleting(null);
        }} />
    </div>
  );
}
