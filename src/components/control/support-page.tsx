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
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_STATUS_LABEL, type ClientRecord, type DirectoryEntry, type Ticket, type TicketStatus } from "@/lib/control/types";
import { cn } from "@/lib/utils";

const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const PRIORITY_VARIANT = { low: "muted", normal: "outline", high: "danger" } as const;
const STATUS_VARIANT = { open: "default", pending: "warning", closed: "muted" } as const;
export const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function TicketBadges({ t }: { t: Pick<Ticket, "status" | "priority"> }) {
  return <span className="flex flex-wrap items-center gap-1.5"><Badge variant={STATUS_VARIANT[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>{t.priority !== "normal" && <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority === "high" ? "High priority" : "Low priority"}</Badge>}</span>;
}

function NewTicketDialog({ clients, defaultClientId, onClose }: { clients: Pick<ClientRecord, "id" | "name">[]; defaultClientId?: string; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ subject: "", body: "", clientId: defaultClientId ?? "", priority: "normal" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch("/api/control/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { router.push(`/control/support/${json.id}`); return; }
      setErrors(json?.error?.fields ?? {}); setMessage(json?.error?.message ?? "Could not save. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>New ticket</DialogTitle>
        <DialogDescription>Log a request from a client so nothing gets lost.</DialogDescription>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5"><Label htmlFor="t-subject">Subject</Label><Input id="t-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-invalid={!!errors.subject} autoFocus />{errors.subject && <p role="alert" className="text-xs text-destructive">{errors.subject}</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="t-client">Client</Label><select id="t-client" className={SELECT} value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">No client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="t-priority">Priority</Label><select id="t-priority" className={SELECT} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}</select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="t-body">Details</Label><textarea id="t-body" rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />{errors.body && <p role="alert" className="text-xs text-destructive">{errors.body}</p>}</div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create ticket"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The support queue. */
export function SupportPage({ tickets, clients, directory, canEdit, sample }: { tickets: Ticket[]; clients: Pick<ClientRecord, "id" | "name">[]; directory: DirectoryEntry[]; canEdit: boolean; sample?: boolean }) {
  const [filter, setFilter] = useState<TicketStatus | "all">("open");
  const [creating, setCreating] = useState(false);
  const who = new Map(directory.map((d) => [d.userId, d.displayName]));
  const rows = tickets.filter((t) => filter === "all" || t.status === filter);
  const count = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Support</h1><p className="text-sm text-muted-foreground">Requests from clients, who has them, and where they stand.</p></div>
        {canEdit && <Button onClick={() => setCreating(true)}><Plus /> New ticket</Button>}
      </div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample tickets.</p>}
      <div className="flex flex-wrap gap-2">
        {(["open", "pending", "closed", "all"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={cn("h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === s ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
            {s === "all" ? `All ${tickets.length}` : `${TICKET_STATUS_LABEL[s]} ${count(s)}`}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-panel"><p className="font-medium">{tickets.length === 0 ? "No tickets yet" : "Nothing here"}</p><p className="mt-1 text-sm text-muted-foreground">{tickets.length === 0 ? "New requests from clients will show up in this queue." : "Try another filter."}</p></div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-panel">
          {rows.map((t) => (
            <li key={t.id}>
              {(() => {
                const inner = (<>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.subject}</span><span className="block truncate text-xs text-muted-foreground">{t.clientName || "No client"} · opened {when(t.createdAt)}{t.assignee ? ` · ${who.get(t.assignee) ?? "Teammate"}` : " · Unassigned"}</span></span>
                  <TicketBadges t={t} />
                </>);
                const cls = "flex flex-wrap items-center justify-between gap-2 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
                return sample ? <div className={cls}>{inner}</div> : <Link href={`/control/support/${t.id}`} className={cn(cls, "hover:bg-muted/50")}>{inner}</Link>;
              })()}
            </li>
          ))}
        </ul>
      )}
      {creating && <NewTicketDialog clients={clients} onClose={() => setCreating(false)} />}
    </div>
  );
}

export { NewTicketDialog };
export { TICKET_STATUSES };
