"use client";

import { Ban, CheckCircle2, Copy, Download, Eye, Link2, Mail, MoreHorizontal, Pencil, Repeat, Send, Trash2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDayShort } from "@/lib/dates";
import { formatMoney, invoiceAlerts, invoiceState } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
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

/** One compact row. Clicking the left side opens the invoice; the right side holds the actions. */
export function InvoiceCard({ invoice, today, actions }: { invoice: Invoice; today: string; actions: InvoiceActions }) {
  const state = invoiceState(invoice, today);
  const alert = invoiceAlerts(invoice, today)[0];
  const open = invoice.status === "draft" || invoice.status === "sent";

  return (
    <li className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4" data-testid="invoice-card">
      <button
        type="button"
        onClick={() => actions.onView(invoice)}
        className="grid min-w-0 flex-1 gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:grid-cols-[minmax(0,1fr)_9.5rem_7rem] sm:items-center sm:gap-4"
        aria-label={`View ${invoice.number}`}
      >
        <span className="block min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{invoice.number}</span>
            <Badge variant={STATE_BADGE[state]}>{STATE_LABEL[state]}</Badge>
            {invoice.recurrence !== "none" && <Repeat className="size-3.5 text-muted-foreground" aria-label="Repeats" />}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{invoice.client}</span>
            {invoice.description && ` · ${invoice.description}`}
          </span>
        </span>
        <span className="block text-sm">
          {alert ? (
            <Badge variant={SEVERITY_BADGE[alert.severity]}>{alert.message.replace(/\.$/, "")}</Badge>
          ) : (
            <span className="text-muted-foreground">
              {invoice.paidOn ? `Paid ${formatDayShort(invoice.paidOn)}` : `Due ${formatDayShort(invoice.dueOn)}`}
            </span>
          )}
        </span>
        <span className="block text-lg font-semibold tabular-nums sm:text-right">{formatMoney(invoice.amountCents)}</span>
      </button>

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
    </li>
  );
}
