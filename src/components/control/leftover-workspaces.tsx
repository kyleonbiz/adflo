"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteConfirmationMatches } from "@/lib/control/client-delete";
import type { UnlinkedWorkspace } from "@/lib/control/types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Shown at the bottom of Clients, only when there is something to show: workspaces no client owns. Every workspace belongs to a
 * client, so these are leftovers (a client was disconnected). Connect one from its client's AdFlo account card, or delete it here.
 */
export function LeftoverWorkspaces({ workspaces, canDelete }: { workspaces: UnlinkedWorkspace[]; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (workspaces.length === 0 && !msg) return null;

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
    <section aria-label="Workspaces with no client" className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div>
        <h2 className="font-semibold">Workspaces with no client ({workspaces.length})</h2>
        <p className="text-sm text-muted-foreground">Every workspace belongs to a client, so these are leftovers. Connect one from its client&apos;s AdFlo account card, or delete it.</p>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{msg.text}</p>}
      <ul className="divide-y rounded-xl border bg-card">
        {workspaces.map((w) => (
          <li key={w.id} className="space-y-3 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">{w.ownerEmail || "No owner"} · {w.members} {w.members === 1 ? "person" : "people"} · made {day(w.createdAt)}</p>
              </div>
              {canDelete && <Button variant="ghost" size="sm" className="text-destructive hover:bg-red-50" disabled={busy} onClick={() => { setOpen(w.id); setTyped(""); setMsg(null); }}><Trash2 /> Delete workspace and data</Button>}
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
    </section>
  );
}
