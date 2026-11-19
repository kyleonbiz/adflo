"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteConfirmationMatches } from "@/lib/control/client-delete";
import type { UnlinkedWorkspace } from "@/lib/control/types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Workspaces that no client owns. Every workspace should belong to a client, so anything listed here is left over (a client was
 * deleted or disconnected). Connect it to a client from that client's AdFlo account card, or delete it and its data here.
 */
export function WorkspacesPage({ workspaces, canDelete, sample }: { workspaces: UnlinkedWorkspace[]; canDelete: boolean; sample?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function remove(w: UnlinkedWorkspace) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/control/workspaces/${w.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setMsg({ ok: false, text: json?.error?.message ?? "Could not delete the workspace. Nothing was deleted." }); return; }
      setMsg({ ok: true, text: `${w.name} and all its data were deleted.` });
      setOpen(null); setTyped("");
      router.refresh();
    } catch { setMsg({ ok: false, text: "Could not reach the server. Nothing was deleted." }); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="text-sm text-muted-foreground">Workspaces with no client. Every workspace belongs to a client, so these should not be here: connect each to its client, or delete it.</p>
      </div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview. Connect the database to see real workspaces.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{msg.text}</p>}

      {workspaces.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-panel">
          <p className="font-medium">No lingering workspaces</p>
          <p className="mt-1 text-sm text-muted-foreground">Every workspace belongs to a client.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-panel">
          {workspaces.map((w) => (
            <li key={w.id} className="space-y-3 px-4 py-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.ownerEmail || "No owner"} · {w.members} {w.members === 1 ? "person" : "people"} · made {day(w.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm"><Link href="/control/clients">Connect from a client</Link></Button>
                  {canDelete && <Button variant="ghost" size="sm" className="text-destructive hover:bg-red-50" disabled={busy} onClick={() => { setOpen(w.id); setTyped(""); setMsg(null); }}><Trash2 /> Delete workspace and data</Button>}
                </div>
              </div>
              {open === w.id && (
                <div role="alertdialog" aria-label={`Delete ${w.name}`} className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
                  <p className="font-medium">Delete this workspace and everything in it for good?</p>
                  <p>All of its documents, files, records and team are erased now, with no 30-day wait. People&apos;s sign-in accounts are kept. This cannot be undone.</p>
                  <div className="space-y-1.5">
                    <label htmlFor={`del-${w.id}`} className="block font-medium">Type the workspace name to confirm</label>
                    <Input id={`del-${w.id}`} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={w.name} className="max-w-sm bg-white" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" disabled={busy || !deleteConfirmationMatches(w.name, typed)} onClick={() => remove(w)}>{busy ? "Deleting…" : "Delete workspace and data"}</Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setOpen(null)}>Keep</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
