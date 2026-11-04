"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeAudit } from "@/lib/control/validation";
import type { Ticket, TimelineEvent } from "@/lib/control/types";
import { TicketBadges, when } from "./support-page";

const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** Password reset, tickets and history, shown under a client's details. */
export function ClientExtras({ clientId, ownerEmail, tickets, timeline, canEdit }: { clientId: string; ownerEmail: string; tickets: Ticket[]; timeline: TimelineEvent[]; canEdit: boolean }) {
  const [email, setEmail] = useState(ownerEmail);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function reset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setStatus(null);
    try {
      const res = await fetch("/api/control/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      setStatus(res.ok ? { ok: true, text: `Reset email sent to ${email}. The link expires on its own, and you never see the password.` } : { ok: false, text: (await res.json().catch(() => null))?.error?.message ?? "Could not send. Try again." });
    } catch { setStatus({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); }
  }
  return (
    <>
      {canEdit && (
        <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Password reset">
          <h2 className="font-semibold">Reset a password</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sends the person a link to choose a new password. Works for the owner or anyone on this client&apos;s team.</p>
          <form onSubmit={reset} className="mt-3 flex flex-wrap items-end gap-3" noValidate>
            <div className="min-w-56 flex-1 space-y-1.5"><Label htmlFor="reset-email">Their email</Label><Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" variant="outline" disabled={busy || !email}><KeyRound /> {busy ? "Sending…" : "Send reset email"}</Button>
          </form>
          {status && <p role={status.ok ? "status" : "alert"} className={status.ok ? "mt-2 text-sm text-emerald-700" : "mt-2 text-sm text-destructive"}>{status.text}</p>}
        </section>
      )}
      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Tickets">
        <div className="flex items-baseline justify-between gap-2"><h2 className="font-semibold">Tickets</h2><Link href="/control/support" className="text-sm text-primary hover:underline">Open the queue</Link></div>
        {tickets.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No tickets for this client.</p> : (
          <ul className="mt-2 divide-y">{tickets.map((t) => (<li key={t.id}><Link href={`/control/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:underline"><span className="min-w-0 truncate">{t.subject} <span className="text-xs text-muted-foreground">· {when(t.createdAt)}</span></span><TicketBadges t={t} /></Link></li>))}</ul>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Timeline">
        <h2 className="font-semibold">Timeline</h2>
        {timeline.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing recorded yet for client {clientId.slice(0, 8)}.</p> : (
          <ul className="mt-2 divide-y">{timeline.map((e, i) => (<li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-sm"><span>{describeAudit(e.action, e.detail)}</span><span className="text-xs text-muted-foreground">{e.staffEmail || "System"} · {stamp(e.at)}</span></li>))}</ul>
        )}
      </section>
    </>
  );
}
