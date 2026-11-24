"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FilePlus2, Upload } from "lucide-react";
import { downloadText } from "@/components/import/csv-source";
import { InvoicesView } from "@/components/invoices/invoices-page";
import { Button } from "@/components/ui/button";
import { ADFLO_SENDER, SAMPLE_INVOICES, clientDraft, monthLabel, monthlyDrafts } from "@/lib/control/billing";
import { MAX_CHANGES, diffInvoices } from "@/lib/control/billing-db";
import { saveInvoices, useSavedInvoices } from "@/lib/control/billing-storage";
import type { ClientRecord, Plan } from "@/lib/control/types";
import type { Invoice } from "@/lib/invoices/types";
import { useToday } from "@/components/modules/use-today";

async function send(body: { upsert: Invoice[]; remove: string[] }): Promise<string | null> {
  try {
    const res = await fetch("/api/control/billing/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    return (await res.json().catch(() => null))?.error?.message ?? "Could not save. Try again.";
  } catch { return "Could not reach the server. Check your connection and try again."; }
}

/**
 * Billing for AdFlo's clients. It is the same invoice screen the client app uses: create an invoice with line items and
 * tax, view and download it, send it by email with a link to it, send payment reminders and mark it paid. With the database
 * connected the invoices are saved there, shared by the staff, and every change is in the audit log; the preview keeps them in
 * this browser. AdFlo does not take payments.
 */
export function BillingPage({ clients, plans, today, sample, newForClient, invoices, canEdit = true }: { clients: ClientRecord[]; plans: Plan[]; today: string; sample: boolean; newForClient?: string; invoices?: Invoice[]; canEdit?: boolean }) {
  const router = useRouter();
  const browser = useSavedInvoices();
  const [restoreMsg, setRestoreMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const browserDay = useToday();

  // With a database the server hands over the list; changes show at once and are sent in the background (undone if refused).
  const inDatabase = invoices !== undefined;
  const [fromServer, setFromServer] = useState(invoices);
  const [dbList, setDbList] = useState<Invoice[]>(invoices ?? []);
  if (invoices !== fromServer) { setFromServer(invoices); setDbList(invoices ?? []); }
  const latest = useRef(dbList);
  useEffect(() => { latest.current = dbList; }, [dbList]);

  // A first visit in the preview starts with a few labelled examples; the first change saves the list.
  const list = useMemo(() => (inDatabase ? dbList : browser ?? (sample ? SAMPLE_INVOICES(today) : [])), [inDatabase, dbList, browser, sample, today]);
  const forClient = clients.find((c) => c.id === newForClient);
  const billable = useMemo(() => monthlyDrafts(clients, plans, list, browserDay ?? today), [clients, plans, list, browserDay, today]);
  const options = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name, email: c.ownerEmail })), [clients]);
  const month = monthLabel(browserDay ?? today);

  const change = async (next: Invoice[]) => {
    if (!inDatabase) { saveInvoices(next); return; }
    const before = latest.current;
    const d = diffInvoices(before, next);
    if (d.upsert.length + d.remove.length === 0) return;
    setSaveError("");
    setDbList(next); latest.current = next;
    const problem = await send(d);
    if (problem) {
      // Put back only what this change did, in case another change was made meanwhile.
      const undone = [...latest.current.filter((i) => !d.upsert.some((u) => u.id === i.id)), ...before.filter((i) => d.upsert.some((u) => u.id === i.id) || d.remove.includes(i.id))];
      setDbList(undone); latest.current = undone;
      setSaveError(`${problem} That change was not saved.`);
      router.refresh();
    }
  };

  // Invoices that were saved in this browser before the database was connected can be moved over once.
  const browserOnly = inDatabase && browser ? browser.filter((i) => !dbList.some((d) => d.id === i.id)) : [];
  const moveBrowserInvoices = async () => {
    setSaveError("");
    for (let i = 0; i < browserOnly.length; i += MAX_CHANGES) {
      const problem = await send({ upsert: browserOnly.slice(i, i + MAX_CHANGES), remove: [] });
      if (problem) { setSaveError(`${problem} Nothing more was moved.`); router.refresh(); return; }
    }
    setRestoreMsg(`Moved ${browserOnly.length} invoice${browserOnly.length === 1 ? "" : "s"} from this browser to the database.`);
    saveInvoices([]);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {restoreMsg && <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">{restoreMsg}</p>}
      {saveError && <p role="alert" className="py-1 pl-3 text-sm border-l-2 border-red-500 text-destructive">{saveError}</p>}
      {inDatabase && !canEdit && <p role="note" className="py-1 pl-3 text-sm border-l-2 border-amber-500 text-foreground">Your role can look at invoices but not change them. Changes made here are not saved.</p>}
      {browserOnly.length > 0 && (
        <div role="note" className="flex flex-wrap items-center gap-3 py-1 pl-3 text-sm border-l-2 border-amber-500 text-foreground">
          <span>{browserOnly.length} invoice{browserOnly.length === 1 ? " is" : "s are"} saved only in this browser.</span>
          <Button size="sm" variant="outline" disabled={!canEdit} onClick={moveBrowserInvoices}>Move to the database</Button>
        </div>
      )}
      {!inDatabase && <p role="note" className="py-1 pl-3 text-sm border-l-2 border-amber-500 text-foreground">Billing invoices live in this browser only. Use Back up regularly: clearing browser data removes them.</p>}
      {!inDatabase && sample && browser === null && <p className="py-1 pl-3 text-sm border-l-2 border-amber-500 text-foreground">Examples are shown until you make a change. Invoices are saved in this browser only.</p>}
      <InvoicesView
        invoices={list} onChange={change} audit={() => {}}
        title="Billing" subtitle={inDatabase ? "Invoice your clients and track who has paid. Invoices are saved to the database and shared by the team. AdFlo does not take payments." : "Invoice your clients and track who has paid. Invoices are saved in this browser only, and AdFlo does not take payments."}
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
                  await change([...list, ...fresh]);
                  setRestoreMsg(`Restored ${fresh.length} invoice${fresh.length === 1 ? "" : "s"}${data.length - fresh.length > 0 ? `; ${data.length - fresh.length} were already here` : ""}.`);
                } catch { setRestoreMsg("That file could not be read."); }
              }}
            />
          </label>
          <Button variant="outline" disabled={billable.length === 0} onClick={() => change([...list, ...billable])}>
            <FilePlus2 /> Create {month.split(" ")[0]} invoices{billable.length ? ` (${billable.length})` : ""}
          </Button>
          </>
        }
      />
    </div>
  );
}
