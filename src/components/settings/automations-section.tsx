"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { GHOSTED_AFTER, REMINDER_GAP_DAYS } from "@/lib/vendors/follow-up";
import { useRecordsInDatabase } from "@/lib/records/storage";
import { saveSettings, useSettings } from "@/lib/settings/storage";
import { cn } from "@/lib/utils";

/**
 * Things AdFlo does for the business by itself. Every one is off until the owner switches it on, says plainly what it does and who it
 * emails, and can be turned off again at any time.
 */
export function AutomationsSection({ base }: { base: "/app" }) {
  const settings = useSettings();
  const inDatabase = useRecordsInDatabase();
  const on = settings.automation.vendorChase;
  const toggle = () => saveSettings({ ...settings, automation: { ...settings.automation, vendorChase: !on } });
  const replyTo = settings.details.email.trim();

  return (
    <section aria-label="Automations" className="space-y-5 rounded-2xl border bg-card p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id="auto-vendor-chase" className="text-sm font-medium">Ask vendors for missing or expiring documents</p>
          <p className="text-xs text-muted-foreground">
            When a vendor still owes a required document (a certificate of insurance that is missing, expired or about to expire, a W-9, a license), AdFlo emails them for you and follows up, up to three times, until it arrives.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="auto-vendor-chase"
          onClick={toggle}
          className={cn("relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "bg-primary" : "bg-input")}
        >
          <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
        </button>
      </div>

      <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
        <p className="font-medium">How it works</p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>It emails the vendor&apos;s address on file. A vendor with no email is skipped.</li>
          <li>The email is sent in your business&apos;s name, and <strong className="font-medium text-foreground">replies come to you</strong>: {replyTo ? <>to {replyTo}</> : <>to your workspace owner until you add a business email</>}.</li>
          <li>Up to {GHOSTED_AFTER} emails, {REMINDER_GAP_DAYS} days apart, each a little firmer. Then the vendor shows as gone quiet and it is up to you.</li>
          <li>It stops by itself once you mark the document received, or log the vendor&apos;s reply, on their file.</li>
          <li>Every email is written on the vendor&apos;s file, so you can see who was chased and when. Weekdays only.</li>
        </ul>
      </div>

      {on && !replyTo && (
        <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Add your business email in <Link href={`${base}/setup?tab=profile`} className="font-medium underline">Business profile</Link> so vendors&apos; replies reach the right inbox.
        </p>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <MailCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {inDatabase ? "Saved to your workspace and shared with your team. It runs on weekday mornings (US Eastern)." : "In this preview nothing is sent. Connected workspaces send automatically once this is on."}
      </p>
    </section>
  );
}
