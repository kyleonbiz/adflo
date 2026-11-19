"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Link2Off, Mail, Rocket, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteConfirmationMatches } from "@/lib/control/client-delete";
import { welcomeMessage } from "@/lib/control/workspace";
import type { ClientRecord, UnlinkedWorkspace } from "@/lib/control/types";
import { publicOrigin } from "@/lib/public-origin";

const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** The client's AdFlo account: connect their workspace, or create one and invite the owner in a single step. */
export function WorkspaceCard({ client, unlinked, canEdit, isOwner = false }: { client: ClientRecord; unlinked: UnlinkedWorkspace[]; canEdit: boolean; isOwner?: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const [expires, setExpires] = useState<string | null>(null);
  const linked = client.workspaceId != null;
  const hasOwnerEmail = client.ownerEmail.trim() !== "";
  const joined = (client.seatsUsed ?? 0) > 0;

  async function run(body: Record<string, string>, done: string) {
    setBusy(true); setMsg(null); setConfirmUnlink(false);
    try {
      const res = await fetch(`/api/control/clients/${client.id}/workspace`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not do that. Try again." }); return; }
      if (json.expiresAt) setExpires(day(json.expiresAt));
      setMsg({ ok: true, text: done });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); }
  }

  async function eraseWorkspace() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/control/clients/${client.id}/workspace`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not delete the workspace. Nothing was deleted." }); return; }
      setErasing(false); setTyped("");
      setMsg({ ok: true, text: "The workspace and all its data were deleted. The client record is still here: use Delete client to remove it too." });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Nothing was deleted." }); } finally { setBusy(false); }
  }

  async function emailWelcome() {
    setBusy(true); setMsg(null); setCopied(false);
    try {
      const res = await fetch(`/api/control/clients/${client.id}/welcome`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not send the email. Try again." }); return; }
      setMsg({ ok: true, text: `Welcome email sent to ${json.emailedTo} from onboarding@adflo.pro.` });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); }
  }

  async function copyWelcome() {
    const text = welcomeMessage({ clientName: client.name, ownerName: client.ownerName, ownerEmail: client.ownerEmail, signupUrl: `${publicOrigin()}/signup`, expiresOn: expires });
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); setMsg({ ok: false, text: "Could not copy. Select the text from the invitation and copy it by hand." }); }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="AdFlo account">
      <h2 className="font-semibold">AdFlo account</h2>

      {!linked ? (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-muted-foreground">This client has no workspace yet. Seats in use, sign-ins and plan limits start working once one is connected.</p>
          {canEdit ? (
            <>
              <div className="space-y-2 rounded-xl border p-4">
                <p className="text-sm font-medium">Create it for them</p>
                <p className="text-sm text-muted-foreground">Makes an empty workspace named {client.name}, with the standard folders, and invites {hasOwnerEmail ? client.ownerEmail : "the owner"} as its owner. It does not send any email: you send the welcome message yourself with its own button. Nobody from AdFlo is added to it.</p>
                <Button onClick={() => run({ action: "provision" }, "Workspace created and the owner is invited. No email has been sent yet: use Email welcome message when you are ready.")} disabled={busy || !hasOwnerEmail}><Rocket /> Create workspace and invite owner</Button>
                {!hasOwnerEmail && <p className="text-xs text-muted-foreground">Add the owner&apos;s email to the client first (Edit).</p>}
              </div>
              <div className="space-y-2 rounded-xl border p-4">
                <p className="text-sm font-medium">Or connect one they made themselves</p>
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
        <div className="mt-3 space-y-4">
          <p className="text-sm text-muted-foreground">Workspace connected. {joined ? `${client.seatsUsed} ${client.seatsUsed === 1 ? "person has" : "people have"} joined.` : "Nobody has joined yet."}</p>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {!joined && hasOwnerEmail && <Button variant="outline" disabled={busy} onClick={() => run({ action: "invite" }, "Invitation renewed for another 14 days. No email was sent: use Email welcome message to send one.")}><Mail /> Renew invitation</Button>}
              {hasOwnerEmail && <Button variant="outline" disabled={busy} onClick={emailWelcome}><Send /> Email welcome message</Button>}
              {hasOwnerEmail && <Button variant="outline" onClick={copyWelcome}>Copy welcome message</Button>}
              {!confirmUnlink ? <Button variant="ghost" disabled={busy} onClick={() => setConfirmUnlink(true)}><Link2Off /> Disconnect</Button> : (
                <span className="flex items-center gap-2 text-sm">Disconnect from this client? Its data stays in the workspace, which will then be listed at the bottom of Clients as a workspace with no client.
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => run({ action: "unlink" }, "Disconnected.")}>Disconnect</Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmUnlink(false)}>Keep</Button></span>
              )}
            </div>
          )}
          {isOwner && client.status === "cancelled" && (
            !erasing ? (
              <Button variant="ghost" className="text-destructive hover:bg-red-50" disabled={busy} onClick={() => { setErasing(true); setTyped(""); setMsg(null); }}><Trash2 /> Delete workspace and data</Button>
            ) : (
              <div role="alertdialog" aria-label="Delete workspace and data" className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
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
            )
          )}
          {!joined && hasOwnerEmail && <p className="text-xs text-muted-foreground">The owner joins automatically when they sign up with {client.ownerEmail}. Renew invitation extends the invitation without emailing anyone. Email welcome message sends it from onboarding@adflo.pro; Copy welcome message gives you the text to send yourself.</p>}
        </div>
      )}

      {copied && <p role="status" className="mt-3 text-sm text-muted-foreground">Copied. Paste it into your email.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-3 text-sm text-emerald-700" : "mt-3 text-sm text-destructive"}>{msg.text}</p>}
    </section>
  );
}
