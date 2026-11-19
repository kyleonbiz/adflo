"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isAccountOn, statusAfterSwitch } from "@/lib/control/status";
import { CLIENT_STATUSES, STATUS_LABEL, effectivePriceCents, formatMoney, isQuiet, type ClientRecord, type ClientStatus, type Plan, type UnlinkedWorkspace } from "@/lib/control/types";
import { cn } from "@/lib/utils";
import { isNewClient } from "@/lib/control/onboarding";
import { Badge } from "@/components/ui/badge";
import { LeftoverWorkspaces } from "./leftover-workspaces";
import { StatusBadge } from "./status-badge";

interface FormState { createWorkspace: boolean; name: string; status: ClientStatus; plan: string; seatsLimit: string; ownerName: string; ownerEmail: string; notes: string; priceOverrideCents: string; priceNote: string }
const EMPTY: FormState = { createWorkspace: true, name: "", status: "trial", plan: "standard", seatsLimit: "3", ownerName: "", ownerEmail: "", notes: "", priceOverrideCents: "", priceNote: "" };
const fromClient = (c: ClientRecord): FormState => ({ createWorkspace: false, name: c.name, status: c.status, plan: c.plan, seatsLimit: String(c.seatsLimit), ownerName: c.ownerName, ownerEmail: c.ownerEmail, notes: c.notes, priceOverrideCents: c.priceOverrideCents == null ? "" : String(c.priceOverrideCents / 100), priceNote: c.priceNote });

const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function Field({ id, label, error, required, children }: { id: string; label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span aria-hidden className="text-destructive"> *</span>}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ClientDialog({ client, plans, isOwner, onClose, onSaved }: { client: ClientRecord | null; plans: Plan[]; isOwner: boolean; onClose: () => void; onSaved: (warning: string | null, mail?: { emailedTo?: string; emailError?: string }) => void }) {
  const [form, setForm] = useState<FormState>(client ? fromClient(client) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: Exclude<keyof FormState, "createWorkspace">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // A new client needs a name and an owner (the owner is who gets invited). An old client without them can still be edited.
  const mustHaveOwner = !client || client.ownerEmail.trim() !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const missing: Record<string, string> = {};
    if (form.name.trim().length < 2) missing.name = "Enter the client's name.";
    if (mustHaveOwner && form.ownerName.trim().length < 2) missing.ownerName = "Enter the owner's name.";
    if (mustHaveOwner && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim())) missing.ownerEmail = "Enter the owner's email. It is how they get into their workspace.";
    if (Object.keys(missing).length) { setErrors(missing); setMessage("Fill in the required fields (marked *)."); return; }
    setBusy(true); setErrors({});
    try {
      const res = await fetch(client ? `/api/control/clients/${client.id}` : "/api/control/clients", {
        method: client ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        // Only the Owner may send a price; everyone else's request leaves it out so the database rule is never tripped.
        body: JSON.stringify(isOwner ? form : { ...form, priceOverrideCents: undefined, priceNote: undefined }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { onSaved(typeof json.workspaceError === "string" ? json.workspaceError : null, { emailedTo: typeof json.emailedTo === "string" ? json.emailedTo : undefined, emailError: typeof json.emailError === "string" ? json.emailError : undefined }); return; }
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
        <DialogDescription>{client ? "Changes are recorded in the audit log." : "Creates the client and, if you leave the box ticked, their workspace and the owner's invitation in the same step. Fields marked * are required."}</DialogDescription>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="c-name" label="Client name" required error={errors.name}><Input id="c-name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} autoFocus /></Field>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p id="c-on-label" className="text-sm font-medium">Account on</p>
              <p className="text-xs text-muted-foreground">{STATUS_LABEL[form.status]}. Turn off to suspend: their people can no longer open their workspace. Nothing is deleted, and it is recorded in the audit log.</p>
            </div>
            <Switch aria-labelledby="c-on-label" checked={isAccountOn(form.status)} onCheckedChange={(on) => setForm((f) => ({ ...f, status: statusAfterSwitch(client?.status ?? "trial", on) }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-plan" label="Plan" error={errors.plan}>
              <select id="c-plan" value={form.plan} onChange={set("plan")} className={SELECT}>
                {[...new Set([form.plan, ...plans.filter((p) => p.active).map((p) => p.name)])].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field id="c-seats" label="Seats allowed" error={errors.seatsLimit}><Input id="c-seats" inputMode="numeric" value={form.seatsLimit} onChange={set("seatsLimit")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-owner" label="Owner's name" required={mustHaveOwner} error={errors.ownerName}><Input id="c-owner" value={form.ownerName} onChange={set("ownerName")} /></Field>
            <Field id="c-email" label="Owner's email" required={mustHaveOwner} error={errors.ownerEmail}><Input id="c-email" type="email" value={form.ownerEmail} onChange={set("ownerEmail")} /></Field>
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
          {!client && (
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={form.createWorkspace} onChange={(e) => setForm((f) => ({ ...f, createWorkspace: e.target.checked }))} />
              <span><span className="font-medium">Create their workspace and invite the owner</span><span className="block text-xs text-muted-foreground">Makes an empty workspace named after the client. The owner joins it when they sign up with the email above. It also emails the owner their invitation, with a link to confirm it before they sign up.</span></span>
            </label>
          )}
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

/**
 * The on/off switch beside a client's workspace. Off pauses the account (for example after missed payments): their people
 * can no longer open the workspace, and nothing is deleted. On restores it. Cancelled clients are changed on their own page.
 */
function AccountSwitch({ client, onChanged }: { client: ClientRecord; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(on: boolean) {
    if (!on && !window.confirm(`Pause ${client.name}? Their people lose access to their workspace right away. Nothing is deleted, and you can turn it back on at any time.`)) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/control/clients/${client.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: statusAfterSwitch(client.status, on) }) });
      if (!res.ok) { setError((await res.json().catch(() => null))?.error?.message ?? "Could not change it. Try again."); return; }
      onChanged();
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  const on = isAccountOn(client.status);
  return (
    <div className="flex items-center gap-2" title={on ? "Turn off to pause this account, for example for missed payments" : "Paused. Turn on to restore access"}>
      <Switch aria-label={`${client.name} account on`} checked={on} disabled={busy || client.status === "cancelled"} onCheckedChange={change} />
      <span className={cn("text-xs font-medium", on ? "text-emerald-700" : "text-amber-800")}>{client.status === "cancelled" ? "Cancelled" : on ? "On" : "Paused"}</span>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/** The client directory: search, filter by status, add and edit. `canEdit` is false for read-only staff and in the preview. */
export function ClientsPage({ clients, plans, canEdit, isOwner = false, sample, leftovers = [], today = new Date().toISOString().slice(0, 10) }: { clients: ClientRecord[]; plans: Plan[]; canEdit: boolean; isOwner?: boolean; sample?: boolean; leftovers?: UnlinkedWorkspace[]; today?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ClientStatus | "all">("all");
  const [dialog, setDialog] = useState<ClientRecord | "new" | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [mailNote, setMailNote] = useState<{ ok: boolean; text: string } | null>(null);

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
      {mailNote && <p role={mailNote.ok ? "status" : "alert"} className={mailNote.ok ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" : "rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"}>{mailNote.text}</p>}
      {warning && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">The client was saved, but its workspace could not be created: {warning} Open the client and use the AdFlo account card to finish.</p>}
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
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-3 font-medium">Client</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Plan</th><th className="px-3 py-3 text-right font-medium">Seats</th><th className="px-3 py-3 text-right font-medium">Price / mo</th><th className="px-3 py-3 font-medium">Last sign-in</th><th className="px-3 py-3 font-medium">Owner</th><th className="px-3 py-3 font-medium">Workspace</th><th className="px-3 py-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-3 font-medium"><Link href={`/control/clients/${c.id}`} className="rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{c.name}</Link>{isNewClient(c, today) && <Link href={`/control/clients/${c.id}#onboarding`} className="ml-2 align-middle" aria-label={`${c.name} is new: open onboarding`}><Badge variant="warning">New</Badge></Link>}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-3 capitalize">{c.plan}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{c.seatsUsed ?? "—"} / {c.seatsLimit}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{(() => { const p = effectivePriceCents(c, plans); return p == null ? "—" : formatMoney(p); })()}</td>
                  <td className="px-3 py-3 text-muted-foreground">{c.lastActive ? new Date(c.lastActive).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "—"}{isQuiet(c) && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Quiet</span>}</td>
                  <td className="px-3 py-3"><div>{c.ownerName || "—"}</div><div className="text-xs text-muted-foreground">{c.ownerEmail}</div></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-3 whitespace-nowrap">{c.workspaceId ? <span className="text-emerald-700">Created</span> : <Link href={`/control/clients/${c.id}`} className="text-amber-800 hover:underline">Not created</Link>}{canEdit && <AccountSwitch client={c} onChanged={() => router.refresh()} />}</div></td>
                  <td className="px-3 py-3 text-right">{canEdit && <Button variant="outline" size="sm" onClick={() => setDialog(c)} aria-label={`Edit ${c.name}`}>Edit</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && <LeftoverWorkspaces workspaces={leftovers} canDelete={isOwner} />}

      {dialog && <ClientDialog client={dialog === "new" ? null : dialog} plans={plans} isOwner={isOwner} onClose={() => setDialog(null)} onSaved={(w, mail) => { setDialog(null); setWarning(w); setMailNote(mail?.emailedTo ? { ok: true, text: `Invitation emailed to ${mail.emailedTo}.` } : mail?.emailError ? { ok: false, text: `The client and workspace were saved, but the invitation email was not sent: ${mail.emailError}` } : null); router.refresh(); }} />}
    </div>
  );
}
