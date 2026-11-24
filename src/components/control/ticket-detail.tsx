"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_STATUS_LABEL, ticketKey, type DirectoryEntry, type Ticket, type TicketMessage, type TicketNote } from "@/lib/control/types";
import { TOPIC_LABEL, triageTicket } from "@/lib/control/triage";
import { cn } from "@/lib/utils";
import { TicketBadges } from "./support-page";

const SELECT = "h-9 rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** One ticket: its details, who has it, and the running notes. */
export function TicketDetail({ ticket, notes, messages, directory, canEdit }: { ticket: Ticket; notes: TicketNote[]; messages: TicketMessage[]; directory: DirectoryEntry[]; canEdit: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  // Replies reach the client through their workspace, so only a ticket linked to it (the client's own request, or one staff shared) has a conversation.
  const conversational = !!ticket.workspaceId;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const triage = triageTicket(ticket);

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
        <h1 className="text-2xl font-semibold tracking-tight"><span className="mr-2 font-mono text-base font-normal text-muted-foreground">{ticketKey(ticket.ticketNo)}</span>{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><TicketBadges t={ticket} /><span>{TICKET_CATEGORY_LABEL[ticket.category]} · {ticket.clientId ? <Link href={`/control/clients/${ticket.clientId}`} className="hover:underline">{ticket.clientName}</Link> : "No client"}{ticket.requesterName || ticket.requesterEmail ? ` · from ${ticket.requesterName || ticket.requesterEmail}` : ""} · opened {stamp(ticket.createdAt)}</span></div>
      </div>
      {ticket.body && <section className="whitespace-pre-wrap rounded-2xl border bg-card p-5 text-sm shadow-panel" aria-label="Details">{ticket.body}</section>}

      {canEdit && (
        <section className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Manage">
          <label className="space-y-1 text-xs text-muted-foreground">Status<select className={`${SELECT} block`} value={ticket.status} disabled={busy} onChange={(e) => send(`/api/control/tickets/${ticket.id}`, "PATCH", { status: e.target.value })}>{TICKET_STATUSES.map((s) => <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Priority<select className={`${SELECT} block`} value={ticket.priority} disabled={busy} onChange={(e) => send(`/api/control/tickets/${ticket.id}`, "PATCH", { priority: e.target.value })}>{TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Assigned to<select className={`${SELECT} block`} value={ticket.assignee ?? ""} disabled={busy} onChange={(e) => send(`/api/control/tickets/${ticket.id}`, "PATCH", { assignee: e.target.value || null })}><option value="">Unassigned</option>{directory.map((d) => <option key={d.userId} value={d.userId}>{d.displayName}</option>)}</select></label>
        </section>
      )}

      {conversational ? (
        <section className="space-y-3" aria-label="Conversation">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Conversation</h2>
            {canEdit && ticket.source === "staff" && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => send(`/api/control/tickets/${ticket.id}`, "PATCH", { shared: false })}>Stop sharing</Button>}
          </div>
          <p className="text-sm text-muted-foreground">Visible to the client in their app{ticket.requesterEmail ? ` and emailed to ${ticket.requesterEmail}` : ""}. Replying to an open ticket marks it waiting on the client; their reply reopens it.</p>
          {messages.length === 0 ? <p className="text-sm text-muted-foreground">No replies yet.</p> : (
            <ul className="space-y-2">{messages.map((m) => (<li key={m.id} className={cn("rounded-xl border p-4 text-sm shadow-panel", m.authorKind === "staff" ? "border-primary/30 bg-accent/40" : "bg-card")}><p className="whitespace-pre-wrap">{m.body}</p><p className="mt-2 text-xs text-muted-foreground">{m.authorKind === "staff" ? `${m.authorName} (staff)` : `${m.authorName || "Client"} (client)`} · {stamp(m.createdAt)}</p></li>))}</ul>
          )}
          {canEdit && ticket.status !== "closed" && (
            <div className="space-y-2 rounded-xl border bg-card p-4 text-sm" data-testid="triage" aria-label="Suggested triage">
              <p><span className="font-medium">Looks like: {TOPIC_LABEL[triage.topic]}.</span>{triage.reason ? <> <span className="text-amber-700">Suggested high priority: {triage.reason}.</span></> : null} <span className="text-muted-foreground">Suggested from what the request says; nothing is sent or changed for you.</span></p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={!!reply.trim()} onClick={() => setReply(triage.reply)}>Draft a reply</Button>
                {triage.reason && ticket.priority !== "high" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => send(`/api/control/tickets/${ticket.id}`, "PATCH", { priority: "high" })}>Set high priority</Button>}
              </div>
            </div>
          )}
          {canEdit && (
            <form onSubmit={async (e) => { e.preventDefault(); if (await send(`/api/control/tickets/${ticket.id}/messages`, "POST", { body: reply })) setReply(""); }} className="space-y-2">
              <label htmlFor="reply" className="sr-only">Reply to the client</label>
              <textarea id="reply" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the client" className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
              <Button type="submit" disabled={busy || !reply.trim()}>Send reply</Button>
            </form>
          )}
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
          <p>Internal: the client does not see this ticket. {ticket.clientId ? "Share it to talk with them here." : "It has no client to share with."} Use notes for anything private.</p>
          {canEdit && ticket.clientId && <Button type="button" size="sm" disabled={busy} onClick={() => send(`/api/control/tickets/${ticket.id}`, "PATCH", { shared: true })}>Share with client</Button>}
        </div>
      )}

      <section className="space-y-3" aria-label="Notes">
        <h2 className="font-semibold">Internal notes</h2>
        {notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet. Notes are internal (clients never see them) and cannot be edited later.</p> : (
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
