"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { GHOSTED_AFTER, REMINDER_GAP_DAYS } from "@/lib/vendors/follow-up";
import { OVERDUE_NOTICE_DAYS } from "@/lib/invoices/auto";
import { FIRST_REMINDER_AFTER_DAYS, MAX_PACKET_REMINDERS, REMINDER_GAP_DAYS as PACKET_GAP_DAYS } from "@/lib/packets/logic";
import { useRecordsInDatabase } from "@/lib/records/storage";
import { saveSettings, useSettings } from "@/lib/settings/storage";
import type { AutomationPrefs } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

const RECURRING_CHOICES: { value: AutomationPrefs["recurringInvoices"]; label: string; detail: string }[] = [
  { value: "off", label: "Off", detail: "You create each recurring invoice yourself." },
  { value: "draft", label: "Make a draft for me to approve", detail: "Recommended. You review it and send it when you are ready." },
  { value: "send", label: "Make it and send it to the customer", detail: "It goes out the day it is created, if the customer has an email on file." },
];

/**
 * Things AdFlo does for the business by itself. Every one is off until the owner switches it on, says plainly what it does and who it
 * emails, and can be turned off again at any time.
 */
export function AutomationsSection({ base }: { base: "/app" }) {
  const settings = useSettings();
  const inDatabase = useRecordsInDatabase();
  const a = settings.automation;
  const set = (patch: Partial<AutomationPrefs>) => saveSettings({ ...settings, automation: { ...a, ...patch } });
  const replyTo = settings.details.email.trim();
  const emailsCustomers = a.vendorChase || a.invoiceReminders || a.recurringInvoices === "send" || a.packetReminders;

  return (
    <div className="space-y-5">
      <Card id="auto-vendor-chase" title="Ask vendors for missing or expiring documents" on={a.vendorChase} onToggle={() => set({ vendorChase: !a.vendorChase })}
        detail="When a vendor still owes a required document (a certificate of insurance that is missing, expired or about to expire, a W-9, a license), AdFlo emails them for you and follows up, up to three times, until it arrives.">
        <li>It emails the vendor&apos;s address on file. A vendor with no email is skipped.</li>
        <li>The email is sent in your business&apos;s name, and <strong className="font-medium text-foreground">replies come to you</strong>: {replyTo ? <>to {replyTo}</> : <>to your workspace owner until you add a business email</>}.</li>
        <li>Up to {GHOSTED_AFTER} emails, {REMINDER_GAP_DAYS} days apart, each a little firmer. Then the vendor shows as gone quiet and it is up to you.</li>
        <li>It stops by itself once you mark the document received, or log the vendor&apos;s reply, on their file.</li>
        <li>Every email is written on the vendor&apos;s file, so you can see who was chased and when. Weekdays only.</li>
      </Card>

      <Card id="auto-invoice-reminders" title="Remind customers about unpaid invoices" on={a.invoiceReminders} onToggle={() => set({ invoiceReminders: !a.invoiceReminders })}
        detail="AdFlo emails your customer about an invoice you have sent and that has not been paid: before it is due, on the due date, and weekly once it is overdue.">
        <li>Only for invoices marked Sent that have a customer email. Drafts are never emailed.</li>
        <li>Before the due date it follows the reminder days on each invoice (for example 7 and 1). Then on the due date, and {OVERDUE_NOTICE_DAYS.length} overdue notices: {OVERDUE_NOTICE_DAYS.join(", ")} days after.</li>
        <li>It stops the moment you mark the invoice paid or void. Each reminder goes out once, and is recorded on the invoice.</li>
        <li>The email is in your business&apos;s name and links to the invoice. Replies go to the invoice&apos;s own &quot;from&quot; email{replyTo ? <>, or {replyTo}</> : <>, or your workspace owner</>}.</li>
      </Card>

      <Card id="auto-packet-reminders" title="Remind people about unfinished onboarding packets" on={a.packetReminders} onToggle={() => set({ packetReminders: !a.packetReminders })}
        detail="When you email someone a packet (a new hire, subcontractor or client) and they have not sent everything back, AdFlo reminds them for you.">
        <li>Only for packets you have emailed with the Email packet button on Forms &amp; Paperwork. A packet you only keep as a checklist is never emailed.</li>
        <li>The first reminder goes {FIRST_REMINDER_AFTER_DAYS} days after it was sent, then {PACKET_GAP_DAYS} days apart, up to {MAX_PACKET_REMINDERS} times. Then it shows &quot;No reply&quot; and it is up to you.</li>
        <li>Each reminder lists only what is still outstanding. Steps you do yourself are never asked of the person.</li>
        <li>It stops by itself once you tick off everything the person had to provide. Replies go to you{replyTo ? <>, at {replyTo}</> : <>, at your workspace owner until you add a business email</>}.</li>
      </Card>

      <section aria-label="Recurring invoices" className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
        <div className="min-w-0">
          <p id="auto-recurring" className="text-sm font-medium">Create recurring invoices automatically</p>
          <p className="text-xs text-muted-foreground">On the day the next invoice in a recurring series is due to be issued, AdFlo creates it with the same items, amount and payment terms, and emails you what it made.</p>
        </div>
        <div role="radiogroup" aria-labelledby="auto-recurring" className="grid gap-2 sm:grid-cols-3">
          {RECURRING_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={a.recurringInvoices === c.value}
              onClick={() => set({ recurringInvoices: c.value })}
              className={cn("rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", a.recurringInvoices === c.value ? "border-primary bg-accent" : "bg-card hover:bg-muted/50")}
            >
              <span className="block text-sm font-medium">{c.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{c.detail}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">How it works</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>Only for a series whose latest invoice was sent or paid. A draft or voided invoice does not start the next one.</li>
            <li>Nothing is created twice, and a series that stopped long ago is not brought back to life.</li>
            <li>To stop a series, set its latest invoice to one-time or void it.</li>
          </ul>
        </div>
      </section>

      {emailsCustomers && !replyTo && (
        <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Add your business email in <Link href={`${base}/setup?tab=profile`} className="font-medium underline">Business profile</Link> so replies reach the right inbox.
        </p>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <MailCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {inDatabase ? "Saved to your workspace and shared with your team. Vendor follow-ups run on weekday mornings and invoices every morning (US Eastern)." : "In this preview nothing is sent. Connected workspaces send automatically once these are on."}
      </p>
    </div>
  );
}

/** One automation: its switch, a plain description, and how it works. */
function Card({ id, title, detail, on, onToggle, children }: { id: string; title: string; detail: string; on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id={id} className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={id}
          onClick={onToggle}
          className={cn("relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "bg-primary" : "bg-input")}
        >
          <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
        </button>
      </div>
      <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
        <p className="font-medium">How it works</p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">{children}</ul>
      </div>
    </section>
  );
}
