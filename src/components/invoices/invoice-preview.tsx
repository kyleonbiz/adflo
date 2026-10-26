"use client";

import { BellRing, Building2, CreditCard, Download, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { formatDayLong } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, invoiceTotals, lineCents, nextOverdueNotice, nextReminder } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { downloadInvoice } from "./download";

function Contact({ icon: Icon, children }: { icon: typeof Mail; children?: string }) {
  if (!children) return null;
  return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5 shrink-0" aria-hidden />{children}</p>;
}

/** Read-only view of one invoice, with download and edit. */
export function InvoicePreview({
  invoice, today, onOpenChange, onEdit,
}: {
  invoice: Invoice | null;
  today: string;
  onOpenChange: (open: boolean) => void;
  onEdit: (invoice: Invoice) => void;
}) {
  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {invoice && <Body invoice={invoice} today={today} onDownload={() => downloadInvoice(invoice)} onEdit={() => { onOpenChange(false); onEdit(invoice); }} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ invoice, today, onDownload, onEdit }: { invoice: Invoice; today: string; onDownload: () => void; onEdit: () => void }) {
  const { subtotalCents, taxCents, totalCents } = invoiceTotals(invoice.items, invoice.taxRate);
  const s = invoice.sender;
  const reminder = nextReminder(invoice, today);
  const notice = nextOverdueNotice(invoice, today);
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <DialogTitle className="text-3xl font-extrabold tracking-tight">INVOICE</DialogTitle>
          <DialogDescription className="mt-1 flex items-center gap-2 text-base"><Building2 className="size-4" aria-hidden />{s.name}</DialogDescription>
        </div>
        <div className="pr-8 text-right">
          <p className="text-xl font-bold text-emerald-600">{invoice.number}</p>
          <p className="text-xs text-muted-foreground">Issue Date: {invoice.issuedOn}</p>
          <p className="text-xs text-muted-foreground">Due Date: {invoice.dueOn}</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From</p>
          <p className="font-semibold">{s.name}</p>
          <Contact icon={MapPin}>{s.address}</Contact>
          <Contact icon={Phone}>{s.phone}</Contact>
          <Contact icon={Mail}>{s.email}</Contact>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p>
          <p className="font-semibold uppercase">{invoice.client}</p>
          <Contact icon={Mail}>{invoice.clientEmail}</Contact>
        </div>
      </div>

      <section aria-label="Service details">
        <h3 className="mb-2 text-sm font-semibold">Service Details</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs">
              <tr><th className="p-2.5">Description</th><th className="p-2.5 text-right">Qty</th><th className="p-2.5 text-right">Rate</th><th className="p-2.5 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {invoice.items.map((i, n) => (
                <tr key={n} className="border-t">
                  <td className="p-2.5">{i.description}</td>
                  <td className="p-2.5 text-right tabular-nums">{i.qty}</td>
                  <td className="p-2.5 text-right tabular-nums">{formatMoney(i.rateCents)}</td>
                  <td className="p-2.5 text-right font-medium tabular-nums">{formatMoney(lineCents(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-3 w-64 space-y-1 text-sm tabular-nums">
          <div className="flex justify-between"><dt>Subtotal:</dt><dd className="font-medium">{formatMoney(subtotalCents)}</dd></div>
          {invoice.taxRate > 0 && <div className="flex justify-between"><dt>Tax ({invoice.taxRate}%):</dt><dd className="font-medium">{formatMoney(taxCents)}</dd></div>}
          <div className="flex justify-between pt-1 text-base font-bold"><dt>Total Due:</dt><dd className="text-emerald-600">{formatMoney(totalCents)}</dd></div>
        </dl>
      </section>

      {invoice.paymentMethods.length > 0 && (
        <section aria-label="Payment instructions" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <h3 className="flex items-center gap-2 font-semibold"><CreditCard className="size-4 text-primary" aria-hidden />Payment Instructions</h3>
          <p className="mt-2">Please make payment by {invoice.dueOn}</p>
          <p className="mt-2 font-medium">Payment Methods:</p>
          <ul className="list-disc pl-5">{invoice.paymentMethods.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      )}

      {invoice.notes && (
        <section aria-label="Notes" className="text-sm">
          <h3 className="mb-1 text-xs font-semibold">Notes</h3>
          <p className="whitespace-pre-line">{invoice.notes}</p>
        </section>
      )}

      {(reminder || notice) && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <BellRing className="size-3.5" aria-hidden />
          {notice
            ? `Next overdue notice ${formatDayLong(notice)}`
            : `Next reminder ${formatDayLong(reminder!.on)} (${reminder!.daysBefore} day${reminder!.daysBefore === 1 ? "" : "s"} before due)`}
        </p>
      )}

      <div className="space-y-2 border-t pt-4">
        <Button variant="outline" className="w-full" onClick={onDownload}><Download /> Download invoice</Button>
        <Button className="w-full" onClick={onEdit}><Pencil /> Edit Invoice</Button>
      </div>
    </div>
  );
}
