"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, ticketKey, type TicketStatus } from "@/lib/control/types";
import { CLIENT_CATEGORY_HINT, CLIENT_STATUS_LABEL, type MyTicket } from "@/lib/support/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT = { open: "default", pending: "warning", closed: "muted" } as const;
const TEXTAREA = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
/** The browser's own time zone, so the date is the one the reader expects. Server and browser can differ, hence the suppressed hydration warning. */
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
export const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{CLIENT_STATUS_LABEL[status]}</Badge>;
}

function NewRequestDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ category: "question", subject: "", body: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch("/api/support/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { router.push(`/app/support/${json.id}`); return; }
      setErrors(json?.error?.fields ?? {}); setMessage(json?.error?.fields ? "" : json?.error?.message ?? "Could not send. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-6 sm:max-w-lg">
        <DialogTitle>New support request</DialogTitle>
        <DialogDescription>Tell us what you need. Our team replies here and by email.</DialogDescription>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">What kind of request is it?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TICKET_CATEGORIES.map((c) => (
                <label key={c} className={cn("cursor-pointer rounded-lg border bg-card p-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring")}>
                  <input type="radio" name="category" value={c} checked={f.category === c} onChange={() => setF({ ...f, category: c })} className="sr-only" />
                  <span className="block font-medium">{TICKET_CATEGORY_LABEL[c]}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{CLIENT_CATEGORY_HINT[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5"><Label htmlFor="r-subject">Subject</Label><Input id="r-subject" value={f.subject} maxLength={200} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-invalid={!!errors.subject} autoFocus />{errors.subject && <p role="alert" className="text-xs text-destructive">{errors.subject}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="r-body">What is going on?</Label><textarea id="r-body" rows={5} value={f.body} maxLength={5000} onChange={(e) => setF({ ...f, body: e.target.value })} aria-invalid={!!errors.body} className={TEXTAREA} />{errors.body && <p role="alert" className="text-xs text-destructive">{errors.body}</p>}</div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A workspace's support requests: what is open, what is waiting on them, and a way to ask for help. */
export function SupportCenter({ tickets }: { tickets: MyTicket[] }) {
  const [view, setView] = useState<"active" | "closed">("active");
  const [creating, setCreating] = useState(false);
  const active = tickets.filter((t) => t.status !== "closed");
  const closed = tickets.filter((t) => t.status === "closed");
  const rows = view === "active" ? active : closed;
  const waiting = tickets.filter((t) => t.status === "pending").length;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask a question, report a problem or make a request. Everyone in your workspace can see and reply.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus /> New request</Button>
      </div>
      {waiting > 0 && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{waiting === 1 ? "1 request is" : `${waiting} requests are`} waiting on you.</p>}
      <div className="flex gap-2">
        {(["active", "closed"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", view === v ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
            {v === "active" ? `Active ${active.length}` : `Closed ${closed.length}`}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-panel">
          <p className="font-medium">{tickets.length === 0 ? "No requests yet" : view === "active" ? "Nothing active" : "Nothing closed"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tickets.length === 0 ? "When you need a hand, send a request and follow it here." : "Your other requests are under the other tab."}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-panel">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/app/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.subject}</span>
                  <span className="block truncate text-xs text-muted-foreground"><span className="font-mono">{ticketKey(t.ticketNo)}</span> · {TICKET_CATEGORY_LABEL[t.category]} · {t.requesterName || "A teammate"} · updated <span suppressHydrationWarning>{day(t.lastActivity)}</span></span>
                </span>
                <StatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <NewRequestDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
