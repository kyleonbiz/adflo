"use client";

import { BellRing, CheckCircle2, Copy, Pencil, Repeat, Send, Trash2, Ban, Download, Eye, Link2, Mail, MoreHorizontal, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDayLong } from "@/lib/dates";
import { formatMoney, invoiceAlerts, invoiceState, nextOverdueNotice, nextReminder } from "@/lib/invoices/logic";
import { RECURRENCES, type Invoice } from "@/lib/invoices/types";
import { downloadInvoice } from "./download";
import { SEVERITY_BADGE, STATE_BADGE, STATE_LABEL } from "./status";

export interface InvoiceActions {
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
  onNext: (invoice: Invoice) => void;
  onEmail: (invoice: Invoice) => void;
  onReopen: (invoice: Invoice) => void;
  onCopyLink: (invoice: Invoice) => void;
}

export function InvoiceCard({ invoice, today, actions }: { invoice: Invoice; today: string; actions: InvoiceActions }) {
  const state = invoiceState(invoice, today);
  const alerts = invoiceAlerts(invoice, today);
  const reminder = nextReminder(invoice, today);
  const notice = nextOverdueNotice(invoice, today);
  const repeats = RECURRENCES.find((r) => r.value === invoice.recurrence)?.label;
  const open = invoice.status === "draft" || invoice.status === "sent";

  return (
    <li className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="invoice-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{invoice.number}</h3>
            <Badge variant={STATE_BADGE[state]}>{STATE_LABEL[state]}</Badge>
            {invoice.recurrence !== "none" && (
              <Badge variant="muted"><Repeat className="size-3" aria-hidden /> {repeats}</Badge>
            )}
          </div>
          <p className="text-sm">
            <span className="font-medium">{invoice.client}</span>
            {invoice.description && <span className="text-muted-foreground"> · {invoice.description}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            Issued {formatDayLong(invoice.issuedOn)} · Due {formatDayLong(invoice.dueOn)}
            {invoice.paidOn && ` · Paid ${formatDayLong(invoice.paidOn)}`}
          </p>
          {alerts.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Alerts">
              {alerts.map((a) => <li key={a.message}><Badge variant={SEVERITY_BADGE[a.severity]}>{a.message}</Badge></li>)}
            </ul>
          )}
          {(reminder || notice) && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BellRing className="size-3.5" aria-hidden />
              {notice
                ? `Next overdue notice ${formatDayLong(notice)}`
                : `Next reminder ${formatDayLong(reminder!.on)} (${reminder!.daysBefore} day${reminder!.daysBefore === 1 ? "" : "s"} before due)`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <p className="text-xl font-semibold tabular-nums">{formatMoney(invoice.amountCents)}</p>
          <div className="flex items-center gap-2 sm:justify-end">
            {invoice.status === "draft" && (
              <Button size="sm" onClick={() => actions.onEmail(invoice)}><Mail /> Send</Button>
            )}
            {invoice.status === "sent" && (
              <Button size="sm" onClick={() => actions.onPay(invoice)}><CheckCircle2 /> Mark paid</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => downloadInvoice(invoice)}><Download /> Download</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${invoice.number}`}><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => actions.onView(invoice)}><Eye /> View</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.onEdit(invoice)}><Pencil /> Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.onCopyLink(invoice)}><Link2 /> Copy link</DropdownMenuItem>
                {invoice.status === "draft" && (
                  <DropdownMenuItem onSelect={() => actions.onSend(invoice)}><Send /> Mark sent</DropdownMenuItem>
                )}
                {invoice.status === "sent" && (
                  <DropdownMenuItem onSelect={() => actions.onEmail(invoice)}><Mail /> Resend</DropdownMenuItem>
                )}
                {invoice.recurrence !== "none" && invoice.status !== "void" && (
                  <DropdownMenuItem onSelect={() => actions.onNext(invoice)}><Copy /> Create next</DropdownMenuItem>
                )}
                {!open && (
                  <DropdownMenuItem onSelect={() => actions.onReopen(invoice)}>
                    <Undo2 /> {invoice.status === "void" ? "Reopen" : "Undo payment"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {open && <DropdownMenuItem onSelect={() => actions.onVoid(invoice)}><Ban /> Void</DropdownMenuItem>}
                <DropdownMenuItem destructive onSelect={() => actions.onDelete(invoice)}><Trash2 /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </li>
  );
}
