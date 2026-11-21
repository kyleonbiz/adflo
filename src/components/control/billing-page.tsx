"use client";

import { useMemo, useState } from "react";
import { Download, FilePlus2, Upload } from "lucide-react";
import { downloadText } from "@/components/import/csv-source";
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
  const [restoreMsg, setRestoreMsg] = useState("");
  const browserDay = useToday();
  // A first visit in the preview starts with a few labelled examples; the first change saves the list.
  const list = useMemo(() => saved ?? (sample ? SAMPLE_INVOICES(today) : []), [saved, sample, today]);
  const forClient = clients.find((c) => c.id === newForClient);
  const billable = useMemo(() => monthlyDrafts(clients, plans, list, browserDay ?? today), [clients, plans, list, browserDay, today]);
  const options = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name, email: c.ownerEmail })), [clients]);
  const month = monthLabel(browserDay ?? today);

  return (
    <div className="space-y-5">
      {restoreMsg && <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">{restoreMsg}</p>}
      <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Billing invoices live in this browser only. Use Back up regularly: clearing browser data removes them.</p>
      {sample && saved === null && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Examples are shown until you make a change. Invoices are saved in this browser only.</p>}
      <InvoicesView
        invoices={list} onChange={saveInvoices} audit={() => {}}
        title="Billing" subtitle="Invoice your clients and track who has paid. Invoices are saved in this browser only, and AdFlo does not take payments."
        clients={options} startNew={!!forClient} draft={forClient ? clientDraft(forClient, plans, today) : undefined} draftClientId={forClient?.id}
        senderKey="adflo.control.invoice.sender" senderDefaults={ADFLO_SENDER}
        headerActions={
          <>
          <Button variant="outline" disabled={list.length === 0} onClick={() => downloadText(JSON.stringify(list, null, 2), `adflo-billing-backup-${today}.json`, "application/json")}><Download /> Back up</Button>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            <Upload className="size-4" aria-hidden /> Restore
            <input
              type="file" accept="application/json,.json" className="sr-only" aria-label="Restore billing invoices from a backup"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                try {
                  const data: unknown = JSON.parse(await f.text());
                  const ok = Array.isArray(data) && data.every((i) => i && typeof i.id === "string" && typeof i.number === "string" && typeof i.client === "string" && typeof i.amountCents === "number");
                  if (!ok || !Array.isArray(data)) { setRestoreMsg("That file is not an AdFlo billing backup."); return; }
                  const have = new Set(list.map((i) => i.id));
                  const fresh = (data as typeof list).filter((i) => !have.has(i.id));
                  saveInvoices([...list, ...fresh]);
                  setRestoreMsg(`Restored ${fresh.length} invoice${fresh.length === 1 ? "" : "s"}${data.length - fresh.length > 0 ? `; ${data.length - fresh.length} were already here` : ""}.`);
                } catch { setRestoreMsg("That file could not be read."); }
              }}
            />
          </label>
          <Button variant="outline" disabled={billable.length === 0} onClick={() => saveInvoices([...list, ...billable])}>
            <FilePlus2 /> Create {month.split(" ")[0]} invoices{billable.length ? ` (${billable.length})` : ""}
          </Button>
          </>
        }
      />
    </div>
  );
}
