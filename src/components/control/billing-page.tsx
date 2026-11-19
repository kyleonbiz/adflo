"use client";

import { useMemo } from "react";
import { FilePlus2 } from "lucide-react";
import { InvoicesView } from "@/components/invoices/invoices-page";
import { Button } from "@/components/ui/button";
import { ADFLO_SENDER, SAMPLE_INVOICES, clientDraft, monthLabel, monthlyDrafts } from "@/lib/control/billing";
import { saveInvoices, useSavedInvoices } from "@/lib/control/billing-storage";
import type { ClientRecord, Plan } from "@/lib/control/types";
import { useToday } from "@/components/modules/use-today";

/**
 * Billing for AdFlo's clients. It is the same invoice screen the client app uses: create an invoice with line items and
 * tax, view and download it, send it by email with a link to it, send payment reminders and mark it paid. Invoices are
 * saved in this browser only, and AdFlo does not take payments.
 */
export function BillingPage({ clients, plans, today, sample, newForClient }: { clients: ClientRecord[]; plans: Plan[]; today: string; sample: boolean; newForClient?: string }) {
  const saved = useSavedInvoices();
  const browserDay = useToday();
  // A first visit in the preview starts with a few labelled examples; the first change saves the list.
  const list = useMemo(() => saved ?? (sample ? SAMPLE_INVOICES(today) : []), [saved, sample, today]);
  const forClient = clients.find((c) => c.id === newForClient);
  const billable = useMemo(() => monthlyDrafts(clients, plans, list, browserDay ?? today), [clients, plans, list, browserDay, today]);
  const options = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name, email: c.ownerEmail })), [clients]);
  const month = monthLabel(browserDay ?? today);

  return (
    <div className="space-y-5">
      {sample && saved === null && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Examples are shown until you make a change. Invoices are saved in this browser only.</p>}
      <InvoicesView
        invoices={list} onChange={saveInvoices} audit={() => {}}
        title="Billing" subtitle="Invoice your clients and track who has paid. Invoices are saved in this browser only, and AdFlo does not take payments."
        clients={options} startNew={!!forClient} draft={forClient ? clientDraft(forClient, plans, today) : undefined} draftClientId={forClient?.id}
        senderKey="adflo.control.invoice.sender" senderDefaults={ADFLO_SENDER}
        headerActions={
          <Button variant="outline" disabled={billable.length === 0} onClick={() => saveInvoices([...list, ...billable])}>
            <FilePlus2 /> Create {month.split(" ")[0]} invoices{billable.length ? ` (${billable.length})` : ""}
          </Button>
        }
      />
    </div>
  );
}
