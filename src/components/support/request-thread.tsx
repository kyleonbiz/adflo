"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TICKET_CATEGORY_LABEL, ticketKey } from "@/lib/control/types";
import type { MyTicketDetail } from "@/lib/support/types";
import { cn } from "@/lib/utils";
import { StatusBadge, stamp } from "./support-center";

/** One request and its conversation, with a reply box and a way to close or reopen it. */
export function RequestThread({ ticket }: { ticket: MyTicketDetail }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = ticket.status === "closed";
  // The request itself is the first message; the rest follow in order.
  const thread = [{ id: "first", authorKind: "client" as const, authorName: ticket.requesterName || "You", body: ticket.body, createdAt: ticket.createdAt }, ...ticket.messages];

  async function send(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { router.refresh(); return true; }
      setError((await res.json().catch(() => null))?.error?.message ?? "Could not send. Try again.");
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(false); }
    return false;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/app/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Support</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><StatusBadge status={ticket.status} /><span><span className="font-mono">{ticketKey(ticket.ticketNo)}</span> · {TICKET_CATEGORY_LABEL[ticket.category]} · opened <span suppressHydrationWarning>{stamp(ticket.createdAt)}</span></span></div>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => send(`/api/support/tickets/${ticket.id}`, "PATCH", { closed: !closed })}>{closed ? "Reopen" : "Mark as solved"}</Button>
      </div>

      <section aria-label="Conversation" className="space-y-3">
        <ul className="space-y-3">
          {thread.map((m) => (
            <li key={m.id} className={cn("rounded-2xl border p-4 text-sm shadow-panel", m.authorKind === "staff" ? "border-primary/30 bg-accent/40" : "bg-card")}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{m.authorKind === "staff" ? `${m.authorName} · AdFlo Support` : m.authorName} · <span suppressHydrationWarning>{stamp(m.createdAt)}</span></p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
        {ticket.status === "pending" && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">AdFlo Support is waiting on your reply.</p>}
        {closed && <p className="text-sm text-muted-foreground">This request is marked as solved. Replying will reopen it.</p>}
        <form onSubmit={async (e) => { e.preventDefault(); if (await send(`/api/support/tickets/${ticket.id}/messages`, "POST", { body: reply })) setReply(""); }} className="space-y-2">
          <label htmlFor="reply" className="sr-only">Your reply</label>
          <textarea id="reply" rows={4} value={reply} maxLength={5000} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply" className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
          <Button type="submit" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send reply"}</Button>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  );
}
