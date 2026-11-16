"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isAccountOn, statusAfterSwitch } from "@/lib/control/status";
import { CHECKLIST_STEPS, effectivePriceCents, formatMoney, type ClientRecord, type Plan } from "@/lib/control/types";
import { cn } from "@/lib/utils";
import { ClientTiles } from "./client-billing";
import { ClientDialog } from "./clients-page";
import { StatusBadge } from "./status-badge";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "Never");

const SECTIONS = [["details", "Details"], ["onboarding", "Onboarding"], ["account", "Account"], ["billing", "Billing"], ["agreements", "Agreements"], ["support", "Support"], ["history", "History"]] as const;

/** One client's profile: summary, quick actions, then every part of their account in one place. */
export function ClientDetail({ client, plans, canEdit, isOwner, today, sample, openTickets, children }: { client: ClientRecord; plans: Plan[]; canEdit: boolean; isOwner: boolean; today: string; sample: boolean; openTickets: number; children?: React.ReactNode }) {
  const [confirming, setConfirming] = useState<"suspend" | "cancel" | null>(null);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const price = effectivePriceCents(client, plans);
  const done = CHECKLIST_STEPS.filter((s) => client.checklist.includes(s.key)).length;

  async function changeStatus(to: ClientRecord["status"]) {
    setBusy("status"); setError(""); setConfirming(null);
    try {
      const res = await fetch(`/api/control/clients/${client.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to }) });
      if (!res.ok) setError((await res.json().catch(() => null))?.error?.message ?? "Could not change the status.");
      else router.refresh();
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(null); }
  }

  async function toggle(step: string, on: boolean) {
    setBusy(step); setError("");
    try {
      const res = await fetch(`/api/control/clients/${client.id}/checklist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step, done: on }) });
      if (!res.ok) setError((await res.json().catch(() => null))?.error?.message ?? "Could not save that step.");
      else router.refresh();
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(null); }
  }

  const facts: [string, React.ReactNode][] = [
    ["Plan", <span key="p" className="capitalize">{client.plan}</span>],
    ["Price per month", price == null ? "Not set" : <>{formatMoney(price)}{client.priceOverrideCents != null && <span className="ml-1 text-xs text-muted-foreground">own price{client.priceNote ? `: ${client.priceNote}` : ""}</span>}</>],
    ["Seats", `${client.seatsUsed ?? "—"} used of ${client.seatsLimit}`],
    ["Last sign-in", day(client.lastActive)],
    ["Owner", client.ownerName ? `${client.ownerName}${client.ownerEmail ? ` · ${client.ownerEmail}` : ""}` : client.ownerEmail || "—"],
    ["Client since", day(client.startedOn)],
  ];

  return (
    <div className="space-y-5">
      <Link href="/control/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Clients</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <StatusBadge status={client.status} />
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span id="acct-switch" className="text-sm font-medium">Account on</span>
              <Switch aria-labelledby="acct-switch" checked={isAccountOn(client.status)} disabled={busy === "status"}
                onCheckedChange={(on) => (on ? changeStatus(statusAfterSwitch(client.status, true)) : setConfirming("suspend"))} />
            </div>
            {client.status === "trial" && <Button size="sm" disabled={busy === "status"} onClick={() => changeStatus("active")}>End trial: make active</Button>}
            {client.status !== "cancelled" && <Button variant="ghost" size="sm" disabled={busy === "status"} onClick={() => setConfirming("cancel")}>Cancel client</Button>}
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
          </div>
        )}
      </div>
      {confirming && (
        <div role="alertdialog" aria-label="Confirm" className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {confirming === "suspend" ? "Suspend this client? Their people lose access to their workspace right away. It is recorded in the audit log, and nothing is deleted. Turn the switch back on to restore it." : "Cancel this client? Their people lose access to their workspace. Their data is kept."}
          <Button variant="destructive" size="sm" disabled={busy === "status"} onClick={() => changeStatus(confirming === "suspend" ? "suspended" : "cancelled")}>{confirming === "suspend" ? "Suspend" : "Cancel client"}</Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>Keep</Button>
        </div>
      )}

      <ClientTiles client={client} plans={plans} today={today} sample={sample} openTickets={openTickets} />

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="h-8 rounded-full border bg-card px-3 text-xs font-medium leading-8 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{label}</a>)}
      </nav>

      <section id="details" className="scroll-mt-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Details">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([k, v]) => (<div key={k} className="min-w-0"><dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words text-sm font-medium">{v}</dd></div>))}
        </dl>
        {client.notes && <p className="mt-4 whitespace-pre-wrap border-t pt-4 text-sm text-muted-foreground">{client.notes}</p>}
      </section>

      <section id="onboarding" className="scroll-mt-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Onboarding">
        <div className="flex items-baseline justify-between gap-2"><h2 className="font-semibold">Onboarding</h2><span className="text-sm text-muted-foreground tabular-nums">{done} of {CHECKLIST_STEPS.length} done</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(done / CHECKLIST_STEPS.length) * 100}%` }} /></div>
        <ul className="mt-4 space-y-1">
          {CHECKLIST_STEPS.map((s) => {
            const on = client.checklist.includes(s.key);
            return (
              <li key={s.key}>
                <button type="button" disabled={!canEdit || busy === s.key} onClick={() => toggle(s.key, !on)} aria-pressed={on}
                  className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-sm outline-none enabled:hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default">
                  <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-emerald-500 bg-emerald-500 text-white" : "border-input")}>{on && <Check className="size-3.5" />}</span>
                  <span className={cn(on && "text-muted-foreground")}>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      {children}
      {editing && <ClientDialog client={client} plans={plans} isOwner={isOwner} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); router.refresh(); }} />}
    </div>
  );
}
