"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteConfirmationMatches } from "@/lib/control/client-delete";
import { Switch } from "@/components/ui/switch";
import { isAccountOn, statusAfterSwitch } from "@/lib/control/status";
import { effectivePriceCents, formatMoney, type ClientRecord, type Plan } from "@/lib/control/types";
import { ClientTiles } from "./client-billing";
import { OnboardingGuide } from "./onboarding-guide";
import { ClientDialog } from "./clients-page";
import { StatusBadge } from "./status-badge";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "Never");

const SECTIONS = [["details", "Details"], ["onboarding", "Onboarding"], ["account", "Account"], ["billing", "Billing"], ["agreements", "Agreements"], ["support", "Support"], ["history", "History"]] as const;

/** One client's profile: summary, quick actions, then every part of their account in one place. */
export function ClientDetail({ client, plans, canEdit, isOwner, today, sample, openTickets, children }: { client: ClientRecord; plans: Plan[]; canEdit: boolean; isOwner: boolean; today: string; sample: boolean; openTickets: number; children?: React.ReactNode }) {
  const [confirming, setConfirming] = useState<"suspend" | "cancel" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const price = effectivePriceCents(client, plans);
  
  async function changeStatus(to: ClientRecord["status"]) {
    setBusy("status"); setError(""); setConfirming(null);
    try {
      const res = await fetch(`/api/control/clients/${client.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to }) });
      if (!res.ok) setError((await res.json().catch(() => null))?.error?.message ?? "Could not change the status.");
      else router.refresh();
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(null); }
  }

  async function deleteClient() {
    setBusy("delete"); setError("");
    try {
      const res = await fetch(`/api/control/clients/${client.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { router.replace("/control/clients"); router.refresh(); return; }
      setError(json?.error?.message ?? "Could not delete the client. Try again.");
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
            {isOwner && !sample && <Button variant="ghost" size="sm" className="text-destructive hover:bg-red-50" onClick={() => { setDeleting(true); setTyped(""); setError(""); }}><Trash2 /> Delete client</Button>}
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

      {deleting && (
        <div role="alertdialog" aria-label="Delete client" className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Delete {client.name} permanently?</p>
          <p>This removes the client record with its onboarding steps, the agreements sent to them and the reminder log. Support tickets are kept but no longer linked to a client. Their AdFlo workspace and its data are <strong>not</strong> deleted. This cannot be undone.</p>
          {client.workspaceId ? (
            <p className="rounded bg-white/70 px-2 py-1.5">Their workspace is still connected. Use <strong>Disconnect</strong> in the AdFlo account card first, then delete. To stop their access without deleting anything, cancel the client instead.</p>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="del-confirm" className="block font-medium">Type the client&apos;s name to confirm</label>
              <Input id="del-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={client.name} className="max-w-sm bg-white" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!client.workspaceId && <Button variant="destructive" size="sm" disabled={busy === "delete" || !deleteConfirmationMatches(client.name, typed)} onClick={deleteClient}>{busy === "delete" ? "Deleting…" : "Delete client"}</Button>}
            <Button variant="outline" size="sm" disabled={busy === "delete"} onClick={() => { setDeleting(false); setTyped(""); }}>Keep</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}

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

      <OnboardingGuide client={client} canEdit={canEdit} onEdit={() => setEditing(true)} />

      {children}
      {editing && <ClientDialog client={client} plans={plans} isOwner={isOwner} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); router.refresh(); }} />}
    </div>
  );
}
