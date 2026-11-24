"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/components/modules/use-today";
import { billFileName } from "@/lib/dms/bill";
import type { DmsApi } from "@/lib/dms/client/api";
import type { BillRead, DocumentRecord } from "@/lib/dms/types";
import { formatDayShort } from "@/lib/dates";
import { formatMoney } from "@/lib/invoices/logic";
import { clearReminder, setReminderOn } from "@/lib/reminders/logic";
import { saveReminders, useReminders } from "@/lib/reminders/storage";
import { SectionLabel } from "./document-metadata";

const remId = (docId: string) => `rem-bill-${docId}`;

/**
 * Shown for an invoice or receipt: who it is from, its number, date, due date and total, read from the document. One click names the
 * file after what it says, and a bill with a due date can put a reminder to pay it on the calendar. Nothing is done until pressed.
 */
export function BillCard({ doc, api, canEdit, onRename }: { doc: DocumentRecord; api: DmsApi; canEdit: boolean; onRename: (name: string) => Promise<boolean> }) {
  const today = useToday() ?? "";
  const key = `${doc.id}:${doc.currentVersion}`;
  const [result, setResult] = useState<{ key: string; read: BillRead | null } | null>(null);
  const [done, setDone] = useState<{ key: string; text: string } | null>(null);
  const reminders = useReminders();

  const isBill = doc.category === "invoice" || doc.category === "receipt";
  useEffect(() => {
    if (!isBill) return;
    let live = true;
    api.readBill(doc.id).then((read) => live && setResult({ key, read })).catch(() => live && setResult({ key, read: null }));
    return () => { live = false; };
  }, [api, doc.id, key, isBill]);

  if (!isBill) return null;
  const read = result?.key === key ? result.read : undefined;
  const message = done?.key === key ? done.text : "";
  const label = doc.category === "receipt" ? "Receipt" : "Invoice";

  return (
    <section aria-labelledby="bill-heading" data-testid="bill-card">
      <SectionLabel id="bill-heading">{label} details</SectionLabel>
      {read === undefined && <Skeleton className="h-16 w-full" aria-label={`Reading the ${label.toLowerCase()}`} />}
      {read === null && <p className="text-xs text-muted-foreground">Could not read this document just now. Try again in a moment.</p>}
      {read && read.status === "unreadable" && <p className="text-xs text-muted-foreground">This file has no readable text (a photo or scan), so nothing was read from it. A PDF version can be read automatically.</p>}
      {read && (read.status === "no_details" || read.status === "not_bill") && <p className="text-xs text-muted-foreground">No total or number could be found in this document.</p>}
      {read && read.status === "found" && (() => {
        const b = read.bill;
        const name = billFileName(b, doc.category === "receipt" ? "receipt" : "invoice");
        const canRemind = doc.category === "invoice" && !!b.dueOn && b.dueOn >= today;
        const reminder = reminders.find((r) => r.id === remId(doc.id));
        const rows: [string, string | null][] = [
          ["From", b.from], ["Number", b.number], ["Date", b.issuedOn ? formatDayShort(b.issuedOn) : null],
          ...(doc.category === "invoice" ? [["Due", b.dueOn ? formatDayShort(b.dueOn) : null] as [string, string | null]] : []),
          ["Total", b.totalCents !== null ? formatMoney(b.totalCents) : null],
        ];
        const say = (text: string) => setDone({ key, text });
        return (
          <div className="space-y-3 rounded-xl border bg-card p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Receipt className="size-4 shrink-0 text-primary" aria-hidden /> Read from the document</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {rows.filter(([, v]) => v).map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words font-medium">{v}</dd></div>))}
            </dl>
            {message ? <p role="status" className="text-xs text-emerald-700">{message}</p> : (
              <div className="flex flex-wrap gap-2">
                {canEdit && name && name !== doc.displayName && (
                  <Button size="sm" variant="outline" onClick={async () => { if (await onRename(name)) say(`Renamed to ${name}.`); }}>Use as the file name</Button>
                )}
                {canRemind && !reminder && (
                  <Button size="sm" onClick={() => { saveReminders(setReminderOn(reminders, { id: remId(doc.id), text: `Pay ${b.from ?? "bill"}${b.totalCents !== null ? ` ${formatMoney(b.totalCents)}` : ""}${b.number ? ` (${b.number})` : ""}`, area: "Documents", href: "/app" }, b.dueOn!)); say(`You will be reminded on ${formatDayShort(b.dueOn!)}, the day it is due.`); }}>Remind me to pay it</Button>
                )}
                {reminder && <Button size="sm" variant="outline" onClick={() => { saveReminders(clearReminder(reminders, remId(doc.id))); say("Reminder removed."); }}>Remove the payment reminder</Button>}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Read automatically, so check it against the document.</p>
          </div>
        );
      })()}
    </section>
  );
}
