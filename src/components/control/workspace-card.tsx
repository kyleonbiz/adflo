"use client";

import { BILLING_LABEL } from "@/lib/billing/sync";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Link2, Link2Off, Mail, Pencil, Rocket, Send, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isAccountOn, statusAfterSwitch } from "@/lib/control/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteConfirmationMatches } from "@/lib/control/client-delete";
import { cooldownHoursLeft, reminderAgo } from "@/lib/control/reminders";
import { invitationMessage, welcomeMessage } from "@/lib/control/workspace";
import { publicOrigin } from "@/lib/public-origin";
import { SEAT_PRICE_CENTS } from "@/lib/control/tiers";
import { STATUS_LABEL, effectivePriceCents, extraSeats, formatMoney, type ClientRecord, type Plan, type UnlinkedWorkspace } from "@/lib/control/types";

const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const dayOrNever = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "Never");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * The one place for a client's account: its details (edited here), its status (on, off, cancelled), its workspace and the owner's access (create or connect,
 * invite, welcome email), and removing it (disconnect, delete the workspace, delete the client). Details live in Edit.
 */
export function WorkspaceCard({ client, plans, unlinked, canEdit, isOwner = false, onEdit }: { client: ClientRecord; plans: Plan[]; unlinked: UnlinkedWorkspace[]; canEdit: boolean; isOwner?: boolean; onEdit?: () => void }) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [confirming, setConfirming] = useState<"suspend" | "cancel" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [needAck, setNeedAck] = useState(false);
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState<"" | "invitation" | "welcome">("");
  // Which of the owner-access buttons is working, and whether the message on screen belongs to them (so it shows right under them).
  const [working, setWorking] = useState<"invite" | "invitation" | "email" | "remind" | null>(null);
  const [msgInAccess, setMsgInAccess] = useState(false);
  const [expires, setExpires] = useState<string | null>(null);
  const linked = client.workspaceId != null;
  const hasOwnerEmail = client.ownerEmail.trim() !== "";
  const joined = (client.seatsUsed ?? 0) > 0;
  const remindWait = cooldownHoursLeft(client.lastReminderAt);
  const remindedAgo = reminderAgo(client.lastReminderAt);

  async function run(body: Record<string, string>, done: string, access?: "invite") {
    setBusy(true); setMsg(null); setConfirmUnlink(false); setCopied(""); setMsgInAccess(!!access); setWorking(access ?? null);
    try {
      const res = await fetch(`/api/control/clients/${client.id}/workspace`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not do that. Try again." }); return; }
      if (json.expiresAt) setExpires(day(json.expiresAt));
      // Creating the workspace and inviting the owner also email the invitation; say what happened to that email.
      if (json.emailedTo) setMsg({ ok: true, text: `${done} The invitation email was sent to ${json.emailedTo} from onboarding@adflo.pro.` });
      else if (json.emailError) setMsg({ ok: false, text: `${done} The invitation email was not sent: ${json.emailError}` });
      else setMsg({ ok: true, text: done });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); setWorking(null); }
  }

  async function eraseWorkspace() {
    setBusy(true); setMsg(null); setMsgInAccess(false);
    try {
      const res = await fetch(`/api/control/clients/${client.id}/workspace`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not delete the workspace. Nothing was deleted." }); return; }
      setErasing(false); setTyped("");
      setMsg({ ok: true, text: "The workspace and all its data were deleted. The client record is still here: use Delete client to remove it too." });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Nothing was deleted." }); } finally { setBusy(false); }
  }

  async function changeStatus(to: ClientRecord["status"]) {
    setBusy(true); setMsg(null); setMsgInAccess(false); setConfirming(null);
    try {
      const res = await fetch(`/api/control/clients/${client.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to }) });
      if (!res.ok) { setMsg({ ok: false, text: (await res.json().catch(() => null))?.error?.message ?? "Could not change the status." }); return; }
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); }
  }

  async function deleteClient() {
    setBusy(true); setMsg(null); setMsgInAccess(false);
    try {
      const res = await fetch(`/api/control/clients/${client.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed, acknowledgeAgreements: ack }) });
      const json = await res.json().catch(() => null);
      if (json?.error?.code === "needs_ack") setNeedAck(true);
      if (res.ok && json?.ok) { router.replace("/control/clients"); router.refresh(); return; }
      setMsg({ ok: false, text: json?.error?.message ?? "Could not delete the client. Try again." });
    } catch { setMsg({ ok: false, text: "Could not reach the server. Nothing was deleted." }); } finally { setBusy(false); }
  }

  async function emailWelcome() {
    setBusy(true); setMsg(null); setCopied(""); setMsgInAccess(true); setWorking("email");
    try {
      const res = await fetch(`/api/control/clients/${client.id}/welcome`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not send the email. Try again." }); return; }
      setMsg({ ok: true, text: `Welcome email sent to ${json.emailedTo} from onboarding@adflo.pro.` });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); setWorking(null); }
  }

  async function emailInvitationNow() {
    setBusy(true); setMsg(null); setCopied(""); setMsgInAccess(true); setWorking("invitation");
    try {
      const res = await fetch(`/api/control/clients/${client.id}/invitation`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not send the email. Try again." }); return; }
      setMsg({ ok: true, text: `Invitation email sent to ${json.emailedTo} from onboarding@adflo.pro.` });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); setWorking(null); }
  }

  /** The "your invitation is waiting" reminder: a fresh confirm link with a friendly lead-in. Once a day, and logged. */
  async function remindNow() {
    setBusy(true); setMsg(null); setCopied(""); setMsgInAccess(true); setWorking("remind");
    try {
      const res = await fetch(`/api/control/clients/${client.id}/remind`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "signup" }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not send the reminder. Try again." }); return; }
      setMsg({ ok: true, text: `Reminder sent to ${json.emailedTo} from onboarding@adflo.pro.` });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); setWorking(null); }
  }

  async function copyInvitation() {
    setMsg(null); setMsgInAccess(true);
    // The invitation carries a fresh confirm link, so one is made first (nothing is emailed).
    let link: string, until: string | null = expires;
    try {
      const res = await fetch(`/api/control/clients/${client.id}/invite-link`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setCopied(""); setMsg({ ok: false, text: json?.error?.message ?? "Could not make the invitation link. Try again." }); return; }
      link = json.link; if (json.expiresAt) { until = day(json.expiresAt); setExpires(until); }
    } catch { setCopied(""); setMsg({ ok: false, text: "Could not reach the server. Try again." }); return; }
    const text = invitationMessage({ clientName: client.name, ownerName: client.ownerName, ownerEmail: client.ownerEmail, inviteUrl: link, expiresOn: until });
    try { await navigator.clipboard.writeText(text); setCopied("invitation"); } catch { setCopied(""); setMsg({ ok: false, text: "Could not copy. Select the text from the invitation and copy it by hand." }); }
  }

  async function copyWelcome() {
    setMsg(null); setMsgInAccess(true);
    const text = welcomeMessage({ clientName: client.name, ownerName: client.ownerName, loginUrl: `${publicOrigin()}/login` });
    try { await navigator.clipboard.writeText(text); setCopied("welcome"); } catch { setCopied(""); setMsg({ ok: false, text: "Could not copy. Select the text and copy it by hand." }); }
  }

  const price = effectivePriceCents(client, plans);
  const facts: [string, React.ReactNode][] = [
    ["Plan", <span key="p" className="capitalize">{client.plan}</span>],
    ["Price per month", price == null ? "Not set" : <>{formatMoney(price)}{client.priceOverrideCents != null && <span className="ml-1 text-xs text-muted-foreground">own price{client.priceNote ? `: ${client.priceNote}` : ""}</span>}{extraSeats(client, plans).count > 0 && <span className="ml-1 text-xs text-muted-foreground">includes {extraSeats(client, plans).count} extra seat{extraSeats(client, plans).count === 1 ? "" : "s"} at {formatMoney(SEAT_PRICE_CENTS)}</span>}</>],
    ["Seats", `${client.seatsUsed ?? "—"} used of ${client.seatsLimit}`],
    ["Online billing", client.billingStatus
      ? `${BILLING_LABEL[client.billingStatus] ?? client.billingStatus}${client.billingInterval ? ` · ${client.billingInterval === "year" ? "yearly" : "monthly"}` : ""}${client.periodEnd ? ` · ${client.cancelAtPeriodEnd ? "ends" : "renews"} ${dayOrNever(client.periodEnd)}` : ""}`
      : "Not subscribed online"],
    ["Last sign-in", dayOrNever(client.lastActive)],
    ["Owner", client.ownerName ? `${client.ownerName}${client.ownerEmail ? ` · ${client.ownerEmail}` : ""}` : client.ownerEmail || "—"],
    ["Client since", dayOrNever(client.startedOn)],
  ];
  const sub = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const owner = isOwner && canEdit;

  return (
    <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-panel" aria-label="AdFlo account">
      <h2 className="font-semibold">AdFlo account</h2>

      {/* 1. Details */}
      <div id="details" className="scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={sub}>Details</h3>
          {canEdit && onEdit && <Button variant="outline" size="sm" onClick={onEdit}><Pencil /> Edit details</Button>}
        </div>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([k, v]) => (<div key={k} className="min-w-0"><dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words text-sm font-medium">{v}</dd></div>))}
        </dl>
        {client.notes && <p className="whitespace-pre-wrap border-t pt-3 text-sm text-muted-foreground">{client.notes}</p>}
      </div>

      {/* 2. Status */}
      <div className="space-y-3 border-t pt-5">
        <h3 className={sub}>Status</h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{STATUS_LABEL[client.status]}</span>
          {canEdit && (
            <>
              <div className="flex items-center gap-2">
                <span id="acct-switch" className="text-sm">Account on</span>
                <Switch aria-labelledby="acct-switch" checked={isAccountOn(client.status)} disabled={busy}
                  onCheckedChange={(on) => (on ? changeStatus(statusAfterSwitch(client.status, true)) : setConfirming("suspend"))} />
              </div>
              {client.status === "trial" && <Button size="sm" disabled={busy} onClick={() => changeStatus("active")}>End trial: make active</Button>}
              {client.status !== "cancelled" && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming("cancel")}>Cancel client</Button>}
            </>
          )}
        </div>
        {confirming && (
          <div role="alertdialog" aria-label="Confirm" className="flex flex-wrap items-center gap-2 py-1 pl-3 text-sm border-l-2 border-amber-500 text-foreground">
            {confirming === "suspend" ? "Pause this account, for example for missed payments? Their people lose access to their workspace right away. It is recorded in the audit log, and nothing is deleted. Turn the switch back on to restore it." : "Cancel this client? Their people lose access to their workspace. Their data is kept."}
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => changeStatus(confirming === "suspend" ? "suspended" : "cancelled")}>{confirming === "suspend" ? "Suspend" : "Cancel client"}</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>Keep</Button>
          </div>
        )}
      </div>

      {/* 3. Workspace and the owner's access */}
      <div className="space-y-3 border-t pt-5">
        <h3 className={sub}>Workspace &amp; access</h3>
        {!linked ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">This client has no workspace yet. Seats in use, sign-ins and plan limits start working once one is connected.</p>
            {canEdit ? (
              <>
                <div className="space-y-2 rounded-xl border p-4">
                  <p className="text-sm font-medium">Create it for them</p>
                  <p className="text-sm text-muted-foreground">Makes an empty workspace named {client.name}, with the standard folders, and invites {hasOwnerEmail ? client.ownerEmail : "the owner"} as its owner. It then emails the owner their invitation. Nobody from AdFlo is added to it.</p>
                  <Button onClick={() => run({ action: "provision" }, "Workspace created and the owner is invited.")} disabled={busy || !hasOwnerEmail}><Rocket /> Create workspace and invite owner</Button>
                  {!hasOwnerEmail && <p className="text-xs text-muted-foreground">Add the owner&apos;s email to the client first (Edit).</p>}
                </div>
                <div className="space-y-2 rounded-xl border p-4">
                  <p className="text-sm font-medium">Or connect an existing one</p>
                  {unlinked.length === 0 ? <p className="text-sm text-muted-foreground">No unconnected workspaces right now.</p> : (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="ws-pick" className="sr-only">Workspace</label>
                      <select id="ws-pick" value={pick} onChange={(e) => setPick(e.target.value)} className={`${SELECT} max-w-md flex-1`}>
                        <option value="">Choose a workspace</option>
                        {unlinked.map((w) => <option key={w.id} value={w.id}>{w.name}{w.ownerEmail ? ` · ${w.ownerEmail}` : ""} · {w.members} {w.members === 1 ? "person" : "people"} · made {day(w.createdAt)}</option>)}
                      </select>
                      <Button variant="outline" disabled={busy || !pick} onClick={() => run({ action: "link", workspaceId: pick }, "Workspace connected.")}><Link2 /> Connect</Button>
                    </div>
                  )}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Your role can look but not change accounts.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Workspace connected. {joined ? `${client.seatsUsed} ${client.seatsUsed === 1 ? "person has" : "people have"} joined.` : "Nobody has joined yet."}</p>
            {canEdit && hasOwnerEmail && (
              <div className="space-y-3">
                {!joined && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Invitation: lets the owner confirm and create their account</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => run({ action: "invite" }, "Invitation renewed for another 14 days.", "invite")}><Mail /> {working === "invite" ? "Renewing…" : "Renew invitation"}</Button>
                      <Button variant="outline" disabled={busy} onClick={emailInvitationNow}><Send /> {working === "invitation" ? "Sending…" : "Email invitation"}</Button>
                      <Button variant="outline" onClick={copyInvitation}>{copied === "invitation" ? "Copied" : "Copy invitation"}</Button>
                      <Button disabled={busy || remindWait > 0} onClick={remindNow} aria-label="Remind the owner about their invitation"><BellRing /> {working === "remind" ? "Sending…" : "Remind owner"}</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Invitation pending: the owner has not confirmed it yet.{remindedAgo ? ` Last reminded ${remindedAgo}.` : " Nobody has reminded them yet."}{remindWait > 0 ? ` You can remind them again in about ${remindWait} ${remindWait === 1 ? "hour" : "hours"}.` : ""}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Welcome: sent once the owner has signed in, and says what to do first</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" disabled={busy || !joined} onClick={emailWelcome}><Send /> {working === "email" ? "Sending…" : "Email welcome message"}</Button>
                    <Button variant="outline" disabled={!joined} onClick={copyWelcome}>{copied === "welcome" ? "Copied" : "Copy welcome message"}</Button>
                  </div>
                </div>
              </div>
            )}
            {canEdit && hasOwnerEmail && (working || copied || (msgInAccess && msg)) && (
              <p role={!working && !copied && msg && !msg.ok ? "alert" : "status"} className={!working && !copied && msg ? (msg.ok ? "text-sm text-emerald-700" : "text-sm text-destructive") : "text-sm text-muted-foreground"}>
                {working === "invite" ? "Renewing the invitation…" : working === "invitation" ? "Sending the invitation email…" : working === "remind" ? "Sending the reminder…" : working === "email" ? "Sending the welcome email…" : copied ? "Copied. Paste it into your email." : msg?.text}
              </p>
            )}
            {!joined && hasOwnerEmail && <p className="text-xs text-muted-foreground">The owner opens the link in their invitation, confirms it, then signs up with {client.ownerEmail}. Each new invitation email or copy replaces the earlier link. The welcome message is a separate email for after they have signed in.</p>}
          </div>
        )}
      </div>

      {/* 4. Remove */}
      {canEdit && (linked || owner) && (
        <div className="space-y-3 border-t pt-5">
          <h3 className={sub}>Remove</h3>
          <div className="flex flex-wrap items-center gap-2">
            {linked && (!confirmUnlink ? <Button variant="ghost" disabled={busy} onClick={() => setConfirmUnlink(true)}><Link2Off /> Disconnect workspace</Button> : (
              <span className="flex flex-wrap items-center gap-2 text-sm">Disconnect from this client? Its data stays in the workspace, which will then be listed at the bottom of Clients as a workspace with no client.
                <Button variant="destructive" size="sm" disabled={busy} onClick={() => run({ action: "unlink" }, "Disconnected.")}>Disconnect</Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmUnlink(false)}>Keep</Button></span>
            ))}
            {owner && linked && client.status === "cancelled" && !erasing && <Button variant="ghost" className="text-destructive hover:bg-red-50" disabled={busy} onClick={() => { setErasing(true); setDeleting(false); setTyped(""); setMsg(null); }}><Trash2 /> Delete workspace and data</Button>}
            {owner && !deleting && <Button variant="ghost" className="text-destructive hover:bg-red-50" disabled={busy} onClick={() => { setDeleting(true); setErasing(false); setNeedAck(false); setAck(false); setTyped(""); setMsg(null); }}><Trash2 /> Delete client{linked ? " and workspace" : ""}</Button>}
          </div>

          {erasing && (
            <div role="alertdialog" aria-label="Delete workspace and data" className="space-y-3 py-1 pl-3 text-sm border-l-2 border-red-500 text-destructive">
              <p className="font-medium">Delete this workspace and everything in it for good?</p>
              <p>This removes its documents and their stored files, records, activity and members right away, with no 30-day wait. It cannot be undone. People&apos;s sign-in accounts and the client record are kept.</p>
              <label className="block space-y-1">
                <span>Type the client&apos;s name to confirm: <strong>{client.name}</strong></span>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-label="Type the client name to confirm" />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="destructive" size="sm" disabled={busy || !deleteConfirmationMatches(client.name, typed)} onClick={eraseWorkspace}>{busy ? "Deleting…" : "Delete workspace and data"}</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setErasing(false)}>Keep</Button>
              </div>
            </div>
          )}

          {deleting && (
            <div role="alertdialog" aria-label="Delete client" className="space-y-3 py-1 pl-3 text-sm border-l-2 border-red-500 text-destructive">
              <p className="font-medium">Delete {client.name} permanently?</p>
              <p>This removes the client record with its onboarding steps, the agreements sent to them and the reminder log. Support tickets are kept but no longer linked to a client.{linked ? <> <strong>Their workspace is deleted too</strong>: its documents, stored files, records and team are erased right away, with no 30-day wait.</> : ""} The owner&apos;s and members&apos; sign-in accounts are removed too (unless they also belong to another client). This cannot be undone.</p>
              {client.status === "active" && <p className="rounded bg-white/70 px-2 py-1.5">This client is active. Cancel them first, then delete.</p>}
              {needAck && (
                <label className="flex items-start gap-2 rounded bg-white/70 px-2 py-1.5">
                  <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span>This client has signed agreements. I understand deleting the client deletes those records too. A copy of who signed what, and when, is kept in the audit log.</span>
                </label>
              )}
              <div className="space-y-1.5">
                <label htmlFor="del-confirm" className="block font-medium">Type the client&apos;s name to confirm</label>
                <Input id="del-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={client.name} className="max-w-sm bg-white" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="destructive" size="sm" disabled={busy || client.status === "active" || (needAck && !ack) || !deleteConfirmationMatches(client.name, typed)} onClick={deleteClient}>{busy ? "Deleting…" : linked ? "Delete client and workspace" : "Delete client"}</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => { setDeleting(false); setTyped(""); }}>Keep</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {msg && !msgInAccess && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{msg.text}</p>}
    </section>
  );
}
