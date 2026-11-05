"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_STATUS_LABEL, type DirectoryEntry, type Ticket, type TicketNote } from "@/lib/control/types";
import { TicketBadges } from "./support-page";

const SELECT = "h-9 rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** One ticket: its details, who has it, and the running notes. */
export function TicketDetail({ ticket, notes, directory, canEdit }: { ticket: Ticket; notes: TicketNote[]; directory: DirectoryEntry[]; canEdit: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { router.refresh(); return true; }
      setError((await res.json().catch(() => null))?.error?.message ?? "Could not save. Try again.");
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(false); }
    return false;
  }

  return (
    <div className="space-y-5">
      <Link href="/control/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Support</Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><TicketBadges t={ticket} /><span>{ticket.clientId ? <Link href={`/control/clients/${ticket.clientId}`} className="hover:underline">{ticket.clientName}</Link> : "No client"} · opened {stamp(ticket.createdAt)}</span></div>
      </div>
      {ticket.body && <section className="whitespace-pre-wrap rounded-2xl border bg-card p-5 text-sm shadow-panel" aria-label="Details">{ticket.body}</section>}

      {canEdit && (
        <section className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Manage">
          <label className="space-y-1 text-xs text-muted-foreground">Status<select className={`${SELECT} block`} value={ticket.status} disabled={busy} onChange={(e) => send(`/api/control/tickets/${ticket.id}`, "PATCH", { status: e.target.value })}>{TICKET_STATUSES.map((s) => <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Priority<select className={`${SELECT} block`} value={ticket.priority} disabled={busy} onChange={(e) => send(`/api/control/tickets/${ticket.id}`, "PATCH", { priority: e.target.value })}>{TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Assigned to<select className={`${SELECT} block`} value={ticket.assignee ?? ""} disabled={busy} onChange={(e) => send(`/api/control/tickets/${ticket.id}`, "PATCH", { assignee: e.target.value || null })}><option value="">Unassigned</option>{directory.map((d) => <option key={d.userId} value={d.userId}>{d.displayName}</option>)}</select></label>
        </section>
      )}

      <section className="space-y-3" aria-label="Notes">
        <h2 className="font-semibold">Notes</h2>
        {notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet. Notes are internal and cannot be edited later.</p> : (
          <ul className="space-y-2">{notes.map((n) => (<li key={n.id} className="rounded-xl border bg-card p-4 text-sm shadow-panel"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-2 text-xs text-muted-foreground">{n.authorEmail || "Staff"} · {stamp(n.createdAt)}</p></li>))}</ul>
        )}
        {canEdit && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await send(`/api/control/tickets/${ticket.id}/notes`, "POST", { body: note })) setNote(""); }} className="space-y-2">
            <label htmlFor="note" className="sr-only">Add a note</label>
            <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
            <Button type="submit" disabled={busy || !note.trim()}>Add note</Button>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  );
}
