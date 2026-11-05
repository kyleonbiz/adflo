"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Download, FilePlus2, Hourglass, NotebookPen, Plus } from "lucide-react";
import { SummaryTile } from "@/components/modules/summary-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PAYMENT_METHODS, SAMPLE_INVOICES, STATUS_TEXT, addDays, displayStatus, invoiceText, invoicesCsv, monthLabel, monthlyDrafts, nextNumber, summarize, validateInvoiceForm,
  type BillingInvoice, type DisplayStatus, type InvoiceForm,
} from "@/lib/control/billing";
import { saveInvoices, useSavedInvoices } from "@/lib/control/billing-storage";
import { effectivePriceCents, formatMoney, type ClientRecord, type Plan } from "@/lib/control/types";
import { cn } from "@/lib/utils";

const VARIANT = { draft: "muted", sent: "default", paid: "success", void: "outline", overdue: "danger" } as const;
const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const FILTERS = ["all", "draft", "sent", "overdue", "paid", "void"] as const;
type Filter = (typeof FILTERS)[number];

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function InvoiceDialog({ invoice, clients, plans, today, onClose, onSave }: { invoice: BillingInvoice | null; clients: ClientRecord[]; plans: Plan[]; today: string; onClose: () => void; onSave: (f: ReturnType<typeof okValue>) => void }) {
  const first = clients[0];
  const [f, setF] = useState<InvoiceForm>(invoice
    ? { clientId: invoice.clientId, description: invoice.description, amount: (invoice.amountCents / 100).toFixed(2), issuedOn: invoice.issuedOn, dueOn: invoice.dueOn, note: invoice.note }
    : { clientId: first?.id ?? "", description: "", amount: "", issuedOn: today, dueOn: addDays(today, 14), note: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof InvoiceForm, string>>>({});
  const set = (k: keyof InvoiceForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Choosing a client on a new invoice suggests what they pay each month.
  function pickClient(e: React.ChangeEvent<HTMLSelectElement>) {
    const c = clients.find((x) => x.id === e.target.value);
    const cents = c ? effectivePriceCents(c, plans) : null;
    setF((s) => ({ ...s, clientId: e.target.value, ...(!invoice && !s.amount && cents ? { amount: (cents / 100).toFixed(2), description: s.description || `AdFlo ${c!.plan} · ${monthLabel(today)}` } : {}) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = validateInvoiceForm(f, clients.map((c) => c.id));
    if (!r.ok) { setErrors(r.errors); return; }
    onSave(r.value);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{invoice ? `Edit ${invoice.number}` : "New invoice"}</DialogTitle>
        <DialogDescription>{invoice ? "Only drafts can be edited." : "Saved as a draft. Mark it sent when you have sent it."}</DialogDescription>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="b-client" label="Client" error={errors.clientId}>
            <select id="b-client" value={f.clientId} onChange={pickClient} className={SELECT}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field id="b-desc" label="What it is for" error={errors.description}><Input id="b-desc" value={f.description} onChange={set("description")} aria-invalid={!!errors.description} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="b-amount" label="Amount ($)" error={errors.amount}><Input id="b-amount" inputMode="decimal" value={f.amount} onChange={set("amount")} aria-invalid={!!errors.amount} /></Field>
            <Field id="b-issued" label="Issued" error={errors.issuedOn}><Input id="b-issued" type="date" value={f.issuedOn} onChange={set("issuedOn")} /></Field>
            <Field id="b-due" label="Due" error={errors.dueOn}><Input id="b-due" type="date" value={f.dueOn} onChange={set("dueOn")} /></Field>
          </div>
          <Field id="b-note" label="Note (optional)" error={errors.note}><Input id="b-note" value={f.note} onChange={set("note")} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{invoice ? "Save changes" : "Save draft"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
const okValue = () => ({ clientId: "", description: "", amountCents: 0, issuedOn: "", dueOn: "", note: "" });

function PaidDialog({ invoice, today, onClose, onPaid }: { invoice: BillingInvoice; today: string; onClose: () => void; onPaid: (paidOn: string, method: string) => void }) {
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>Mark {invoice.number} paid</DialogTitle>
        <DialogDescription>{formatMoney(invoice.amountCents)} from {invoice.clientName}. AdFlo does not take payments; this records that you received it.</DialogDescription>
        <form onSubmit={(e) => { e.preventDefault(); if (paidOn) onPaid(paidOn, method); }} className="space-y-4">
          <Field id="p-date" label="Date received"><Input id="p-date" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} /></Field>
          <Field id="p-method" label="How"><select id="p-method" value={method} onChange={(e) => setMethod(e.target.value)} className={SELECT}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!paidOn}>Mark paid</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({ invoice, today, onClose }: { invoice: BillingInvoice; today: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const st = displayStatus(invoice, today);
  async function copy() {
    try { await navigator.clipboard.writeText(invoiceText(invoice)); setCopied(true); } catch { setCopied(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Invoice {invoice.number}</DialogTitle>
        <DialogDescription>{invoice.clientName}</DialogDescription>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">For</dt><dd>{invoice.description}</dd>
          <dt className="text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">{formatMoney(invoice.amountCents)}</dd>
          <dt className="text-muted-foreground">Issued</dt><dd>{invoice.issuedOn}</dd>
          <dt className="text-muted-foreground">Due</dt><dd>{invoice.dueOn}</dd>
          <dt className="text-muted-foreground">Status</dt><dd><Badge variant={VARIANT[st]}>{STATUS_TEXT[st]}</Badge></dd>
          {invoice.paidOn && (<><dt className="text-muted-foreground">Paid</dt><dd>{invoice.paidOn}{invoice.method ? ` · ${invoice.method}` : ""}</dd></>)}
          {invoice.note && (<><dt className="text-muted-foreground">Note</dt><dd>{invoice.note}</dd></>)}
        </dl>
        <div className="flex items-center justify-end gap-2">
          {copied && <span role="status" className="text-xs text-muted-foreground">Copied. Paste it into your email.</span>}
          <Button variant="outline" onClick={copy}>Copy as text</Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Dlg = { kind: "new" } | { kind: "edit"; inv: BillingInvoice } | { kind: "paid"; inv: BillingInvoice } | { kind: "view"; inv: BillingInvoice } | null;

/** Manual billing: invoices you create and track by hand. Saved in this browser only; no payments are taken and nothing is emailed. */
export function BillingPage({ clients, plans, today, sample }: { clients: ClientRecord[]; plans: Plan[]; today: string; sample: boolean }) {
  const saved = useSavedInvoices();
  // A first visit in the preview starts with a few labelled examples; the first change saves the list.
  const list = useMemo(() => saved ?? (sample ? SAMPLE_INVOICES(today) : []), [saved, sample, today]);
  const [filter, setFilter] = useState<Filter>("all");
  const [dlg, setDlg] = useState<Dlg>(null);
  const [notice, setNotice] = useState("");

  const summary = useMemo(() => summarize(list, today), [list, today]);
  const rows = useMemo(() => [...list].filter((i) => filter === "all" || displayStatus(i, today) === filter).sort((a, b) => b.number.localeCompare(a.number)), [list, filter, today]);
  const count = (f: Filter) => (f === "all" ? list.length : list.filter((i) => displayStatus(i, today) === f).length);
  const billable = useMemo(() => monthlyDrafts(clients, plans, list, today).length, [clients, plans, list, today]);

  const commit = (next: BillingInvoice[], message = "") => { saveInvoices(next); setNotice(message); };
  const update = (id: string, patch: Partial<BillingInvoice>, message?: string) => commit(list.map((i) => (i.id === id ? { ...i, ...patch } : i)), message);

  function save(v: ReturnType<typeof okValue>) {
    const c = clients.find((x) => x.id === v.clientId)!;
    if (dlg?.kind === "edit") update(dlg.inv.id, { ...v, clientName: c.name }, `Saved ${dlg.inv.number}.`);
    else {
      const number = nextNumber(list);
      commit([...list, { id: `inv-${Date.now().toString(36)}`, number, clientName: c.name, ...v, status: "draft", paidOn: null, method: "" }], `Created ${number} as a draft.`);
    }
    setDlg(null);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([invoicesCsv(list, today)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `adflo-invoices-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const action = (i: BillingInvoice, st: DisplayStatus) => {
    const small = "h-8 rounded-md px-3 text-xs";
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button variant="outline" className={small} onClick={() => setDlg({ kind: "view", inv: i })} aria-label={`View ${i.number}`}>View</Button>
        {st === "draft" && <Button variant="outline" className={small} onClick={() => setDlg({ kind: "edit", inv: i })} aria-label={`Edit ${i.number}`}>Edit</Button>}
        {st === "draft" && <Button className={small} onClick={() => update(i.id, { status: "sent" }, `${i.number} marked sent.`)} aria-label={`Mark ${i.number} sent`}>Mark sent</Button>}
        {(st === "sent" || st === "overdue") && <Button className={small} onClick={() => setDlg({ kind: "paid", inv: i })} aria-label={`Mark ${i.number} paid`}>Mark paid</Button>}
        {(st === "draft" || st === "sent" || st === "overdue") && <Button variant="ghost" className={small} onClick={() => update(i.id, { status: "void" }, `${i.number} voided.`)} aria-label={`Void ${i.number}`}>Void</Button>}
        {st === "draft" && <Button variant="ghost" className={cn(small, "text-destructive")} onClick={() => commit(list.filter((x) => x.id !== i.id), `Deleted ${i.number}.`)} aria-label={`Delete ${i.number}`}>Delete</Button>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">Invoice your clients and track who has paid.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={download} disabled={list.length === 0}><Download /> Export CSV</Button>
          <Button variant="outline" disabled={billable === 0} onClick={() => { const d = monthlyDrafts(clients, plans, list, today); commit([...list, ...d], `Created ${d.length} draft${d.length === 1 ? "" : "s"} for ${monthLabel(today)}.`); }}>
            <FilePlus2 /> Create {monthLabel(today).split(" ")[0]} invoices{billable ? ` (${billable})` : ""}
          </Button>
          <Button onClick={() => setDlg({ kind: "new" })} disabled={clients.length === 0}><Plus /> New invoice</Button>
        </div>
      </div>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {sample && saved === null ? "Examples are shown until you make a change. " : ""}Invoices are saved in this browser only. AdFlo does not take payments or send email yet: send each invoice yourself, then mark it sent and paid here.
      </p>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile icon={Hourglass} label="Waiting to be paid" value={formatMoney(summary.outstandingCents)} tone="text-sky-600" />
        <SummaryTile icon={AlertTriangle} label={`Overdue${summary.overdueCount ? ` (${summary.overdueCount})` : ""}`} value={formatMoney(summary.overdueCents)} tone="text-red-600" />
        <SummaryTile icon={CheckCircle2} label="Paid this month" value={formatMoney(summary.paidThisMonthCents)} tone="text-emerald-600" />
        <SummaryTile icon={NotebookPen} label="In drafts" value={formatMoney(summary.draftCents)} tone="text-amber-600" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={cn("h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === f ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
            {f === "all" ? "All" : STATUS_TEXT[f]} {count(f)}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-panel">
          <CircleDollarSign className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">{list.length === 0 ? "No invoices yet" : "No invoices match"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{list.length === 0 ? "Create this month's invoices for every active client, or add one by hand." : "Try a different filter."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-panel">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">For</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="px-4 py-3 font-medium">Due</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((i) => {
                const st = displayStatus(i, today);
                return (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{i.number}</td>
                    <td className="px-4 py-3 font-medium">{i.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(i.amountCents)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{i.dueOn}</td>
                    <td className="px-4 py-3"><Badge variant={VARIANT[st]}>{STATUS_TEXT[st]}</Badge></td>
                    <td className="px-4 py-3">{action(i, st)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dlg && (dlg.kind === "new" || dlg.kind === "edit") && <InvoiceDialog invoice={dlg.kind === "edit" ? dlg.inv : null} clients={clients} plans={plans} today={today} onClose={() => setDlg(null)} onSave={save} />}
      {dlg?.kind === "paid" && <PaidDialog invoice={dlg.inv} today={today} onClose={() => setDlg(null)} onPaid={(paidOn, method) => { update(dlg.inv.id, { status: "paid", paidOn, method }, `${dlg.inv.number} marked paid.`); setDlg(null); }} />}
      {dlg?.kind === "view" && <ViewDialog invoice={dlg.inv} today={today} onClose={() => setDlg(null)} />}
    </div>
  );
}
