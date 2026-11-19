"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Armchair, CircleDollarSign, Clock, LifeBuoy, Plus, Tag } from "lucide-react";
import { SummaryTile } from "@/components/modules/summary-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SAMPLE_INVOICES } from "@/lib/control/billing";
import { useSavedInvoices } from "@/lib/control/billing-storage";
import { invoiceState, summarize } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { STATE_BADGE, STATE_LABEL } from "@/components/invoices/status";
import { effectivePriceCents, formatMoney, type ClientRecord, type Plan } from "@/lib/control/types";

/** This client's invoices from the same browser-saved list the Billing screen uses. */
function useClientInvoices(clientId: string, today: string, sample: boolean): Invoice[] {
  const saved = useSavedInvoices();
  return useMemo(() => (saved ?? (sample ? SAMPLE_INVOICES(today) : [])).filter((i) => i.clientId === clientId), [saved, sample, today, clientId]);
}

/** The headline numbers at the top of a client's profile. */
export function ClientTiles({ client, plans, today, sample, openTickets }: { client: ClientRecord; plans: Plan[]; today: string; sample: boolean; openTickets: number }) {
  const invoices = useClientInvoices(client.id, today, sample);
  const s = summarize(invoices, today);
  const price = effectivePriceCents(client, plans);
  const over = client.seatsUsed != null && client.seatsUsed > client.seatsLimit;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile icon={Tag} label={`Per month · ${client.plan}`} value={price == null ? "Not set" : formatMoney(price)} tone="text-primary" />
        <SummaryTile icon={Armchair} label={`Seats of ${client.seatsLimit}`} value={client.seatsUsed ?? "—"} tone={over ? "text-red-600" : "text-emerald-600"} />
        <SummaryTile icon={CircleDollarSign} label={s.overdueCount ? `Owes (${s.overdueCount} overdue)` : "Owes"} value={formatMoney(s.outstandingCents)} tone={s.overdueCount ? "text-red-600" : "text-sky-600"} href="#billing" />
        <SummaryTile icon={LifeBuoy} label="Open tickets" value={openTickets} tone={openTickets ? "text-amber-600" : "text-emerald-600"} href="#support" />
      </div>
      {over && <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle className="size-4 shrink-0" aria-hidden /> {client.seatsUsed} people are in this workspace but the plan allows {client.seatsLimit}. Raise the seat limit or ask them to remove someone.</p>}
    </div>
  );
}

/** The Billing section on a client's profile. */
export function ClientBilling({ client, today, sample }: { client: ClientRecord; today: string; sample: boolean }) {
  const invoices = useClientInvoices(client.id, today, sample);
  const rows = [...invoices].sort((a, b) => b.number.localeCompare(a.number));
  const s = summarize(invoices, today);
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((t, i) => t + i.amountCents, 0);
  return (
    <section id="billing" className="scroll-mt-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Billing">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Billing</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/control/billing">All invoices</Link></Button>
          <Button asChild size="sm"><Link href={`/control/billing?client=${client.id}`}><Plus /> New invoice</Link></Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {invoices.length === 0 ? "No invoices for this client yet." : `${formatMoney(paidTotal)} paid in total${s.outstandingCents ? ` · ${formatMoney(s.outstandingCents)} waiting to be paid` : ""}.`} Invoices are saved in this browser only.
      </p>
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <tbody className="divide-y">
              {rows.map((i) => {
                const st = invoiceState(i, today);
                return (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs">{i.number}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{i.description}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatMoney(i.amountCents)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums"><Clock className="mr-1 inline size-3 text-muted-foreground" aria-hidden />{i.dueOn}</td>
                    <td className="py-2.5"><Badge variant={STATE_BADGE[st]}>{STATE_LABEL[st]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
