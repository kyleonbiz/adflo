"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLIENT_STATUSES, STATUS_LABEL, effectivePriceCents, formatMoney, type ClientRecord, type ClientStatus, type Plan } from "@/lib/control/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

interface FormState { name: string; status: ClientStatus; plan: string; seatsLimit: string; ownerName: string; ownerEmail: string; notes: string; priceOverrideCents: string; priceNote: string }
const EMPTY: FormState = { name: "", status: "trial", plan: "standard", seatsLimit: "3", ownerName: "", ownerEmail: "", notes: "", priceOverrideCents: "", priceNote: "" };
const fromClient = (c: ClientRecord): FormState => ({ name: c.name, status: c.status, plan: c.plan, seatsLimit: String(c.seatsLimit), ownerName: c.ownerName, ownerEmail: c.ownerEmail, notes: c.notes, priceOverrideCents: c.priceOverrideCents == null ? "" : String(c.priceOverrideCents / 100), priceNote: c.priceNote });

const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ClientDialog({ client, plans, isOwner, onClose, onSaved }: { client: ClientRecord | null; plans: Plan[]; isOwner: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(client ? fromClient(client) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch(client ? `/api/control/clients/${client.id}` : "/api/control/clients", {
        method: client ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        // Only the Owner may send a price; everyone else's request leaves it out so the database rule is never tripped.
        body: JSON.stringify(isOwner ? form : { ...form, priceOverrideCents: undefined, priceNote: undefined }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { onSaved(); return; }
      setErrors(json?.error?.fields ?? {});
      setMessage(json?.error?.message ?? "Could not save. Try again.");
    } catch {
      setMessage("Could not reach the server. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{client ? "Edit client" : "Add client"}</DialogTitle>
        <DialogDescription>{client ? "Changes are recorded in the audit log." : "Creates the client's record. Onboarding steps come next."}</DialogDescription>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="c-name" label="Client name" error={errors.name}><Input id="c-name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-status" label="Status" error={errors.status}>
              <select id="c-status" value={form.status} onChange={set("status")} className={SELECT}>{CLIENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
            </Field>
            <Field id="c-plan" label="Plan" error={errors.plan}>
              <select id="c-plan" value={form.plan} onChange={set("plan")} className={SELECT}>
                {[...new Set([form.plan, ...plans.filter((p) => p.active).map((p) => p.name)])].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field id="c-seats" label="Seats allowed" error={errors.seatsLimit}><Input id="c-seats" inputMode="numeric" value={form.seatsLimit} onChange={set("seatsLimit")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-owner" label="Owner's name" error={errors.ownerName}><Input id="c-owner" value={form.ownerName} onChange={set("ownerName")} /></Field>
            <Field id="c-email" label="Owner's email" error={errors.ownerEmail}><Input id="c-email" type="email" value={form.ownerEmail} onChange={set("ownerEmail")} /></Field>
          </div>
          {isOwner && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="c-price" label="Own monthly price ($)" error={errors.priceOverrideCents}><Input id="c-price" inputMode="decimal" placeholder="Plan price" value={form.priceOverrideCents} onChange={set("priceOverrideCents")} /></Field>
              <Field id="c-price-note" label="Why (optional)" error={errors.priceNote}><Input id="c-price-note" value={form.priceNote} onChange={set("priceNote")} /></Field>
            </div>
          )}
          <Field id="c-notes" label="Internal notes" error={errors.notes}>
            <textarea id="c-notes" rows={3} value={form.notes} onChange={set("notes")} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
          </Field>
          {form.status === "suspended" && client?.status !== "suspended" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Suspending is recorded in the audit log. No data is deleted.</p>}
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : client ? "Save changes" : "Add client"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The client directory: search, filter by status, add and edit. `canEdit` is false for read-only staff and in the preview. */
export function ClientsPage({ clients, plans, canEdit, isOwner = false, sample }: { clients: ClientRecord[]; plans: Plan[]; canEdit: boolean; isOwner?: boolean; sample?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ClientStatus | "all">("all");
  const [dialog, setDialog] = useState<ClientRecord | "new" | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter((c) => (filter === "all" || c.status === filter) && (!needle || [c.name, c.ownerName, c.ownerEmail, c.plan].some((v) => v.toLowerCase().includes(needle))));
  }, [clients, q, filter]);
  const count = (s: ClientStatus) => clients.filter((c) => c.status === s).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">Everyone using AdFlo: status, plan and seats.</p>
        </div>
        {canEdit && <Button onClick={() => setDialog("new")}><Plus /> Add client</Button>}
      </div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample clients. Connect the database to manage real ones.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search clients" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        {(["all", ...CLIENT_STATUSES] as const).map((s) => (
          <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}
            className={cn("h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === s ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
            {s === "all" ? `All ${clients.length}` : `${STATUS_LABEL[s]} ${count(s)}`}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-panel">
          <p className="font-medium">{clients.length === 0 ? "No clients yet" : "No clients match"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{clients.length === 0 ? (canEdit ? "Add your first client to start the directory." : "Clients appear here once staff add them.") : "Try a different search or filter."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-panel">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 text-right font-medium">Seats</th><th className="px-4 py-3 text-right font-medium">Price / mo</th><th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.id.startsWith("sample-") ? c.name : <Link href={`/control/clients/${c.id}`} className="rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{c.name}</Link>}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 capitalize">{c.plan}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.seatsUsed ?? "—"} / {c.seatsLimit}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{(() => { const p = effectivePriceCents(c, plans); return p == null ? "—" : formatMoney(p); })()}</td>
                  <td className="px-4 py-3"><div>{c.ownerName || "—"}</div><div className="text-xs text-muted-foreground">{c.ownerEmail}</div></td>
                  <td className="px-4 py-3 text-right">{canEdit && <Button variant="outline" size="sm" onClick={() => setDialog(c)} aria-label={`Edit ${c.name}`}>Edit</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && <ClientDialog client={dialog === "new" ? null : dialog} plans={plans} isOwner={isOwner} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); router.refresh(); }} />}
    </div>
  );
}
