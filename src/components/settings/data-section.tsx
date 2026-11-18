"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createHttpApi } from "@/lib/dms/client/http-api";
import { DELETION_GRACE_DAYS, type DeletionStatus } from "@/lib/dms/deletion";
import { toDmsError } from "@/lib/dms/errors";
import type { Bootstrap } from "@/lib/dms/types";
import { formatDayLong } from "@/lib/dates";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function call<T>(url: string, method: "GET" | "POST" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json || !json.ok) throw new Error(json && !json.ok ? json.error.message : "Something went wrong. Please try again.");
  return json.data;
}

/** Export everything, and close the workspace (erased after a 30-day grace period). Only for a connected workspace. */
export function DataSection({ mode }: { mode: "live" | "preview" }) {
  if (mode === "preview") {
    return (
      <section aria-label="Data and account" className="rounded-2xl border bg-card p-5 shadow-panel">
        <p className="text-sm text-muted-foreground">
          Exporting your data and closing your workspace are available once your database is connected. Until then everything is kept in this browser, and you can clear it from Demo data.
        </p>
      </section>
    );
  }
  return <LiveData />;
}

function LiveData() {
  const [api] = useState(() => createHttpApi("live"));
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [error, setError] = useState("");
  const [exportNote, setExportNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([api.bootstrap(), call<DeletionStatus>("/api/dms/workspace/deletion")]);
      setBoot(b); setStatus(s); setError("");
    } catch (e) { setError(toDmsError(e).message); }
  }, [api]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (error) return <p role="alert" className="rounded-2xl border bg-card p-5 text-sm text-destructive shadow-panel">{error}</p>;
  if (!boot || !status) return <Skeleton className="h-48 rounded-2xl" aria-busy="true" />;

  const isOwner = boot.role === "owner";
  const canExport = isOwner || boot.role === "admin";
  const workspaceName = boot.workspace.name;

  const startExport = async () => {
    setExporting(true); setExportNote(null);
    try {
      const size = await call<{ documents: number; bytes: number }>("/api/dms/export?check=1");
      setExportNote({ text: `Your download is starting: ${size.documents} document${size.documents === 1 ? "" : "s"} plus all your records. A large workspace can take a few minutes to prepare, so keep this page open.`, bad: false });
      // A plain download link, so the browser saves the zip as it streams in.
      const a = document.createElement("a");
      a.href = "/api/dms/export";
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { setExportNote({ text: (e as Error).message, bad: true }); }
    finally { setExporting(false); }
  };

  const confirmClose = async () => {
    setBusy(true); setDialogError("");
    try {
      setStatus(await call<DeletionStatus>("/api/dms/workspace/deletion", "POST", { confirmName: typed }));
      setClosing(false); setTyped("");
    } catch (e) { setDialogError((e as Error).message); }
    finally { setBusy(false); }
  };
  const cancelClose = async () => {
    setBusy(true);
    try { setStatus(await call<DeletionStatus>("/api/dms/workspace/deletion", "DELETE")); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <section aria-label="Export your data" className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel">
        <h3 className="font-medium">Export your data</h3>
        <p className="text-sm text-muted-foreground">
          Download everything in this workspace as one zip file: your records from every service (as JSON and as spreadsheets), the activity trail, your team list, and all your documents in their folders. Your data is yours, to keep or to take elsewhere.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={startExport} disabled={!canExport || exporting}><Download /> {exporting ? "Checking…" : "Download export"}</Button>
          {!canExport && <span className="text-xs text-muted-foreground">Only owners and admins can export.</span>}
        </div>
        {exportNote && <p role={exportNote.bad ? "alert" : "status"} className={`text-sm ${exportNote.bad ? "text-destructive" : "text-muted-foreground"}`}>{exportNote.text}</p>}
        <p className="text-xs text-muted-foreground">Documents in the trash and older versions are not included.</p>
      </section>

      <section aria-label="Close this workspace" className="space-y-3 rounded-2xl border border-destructive/30 bg-card p-5 shadow-panel">
        <h3 className="font-medium">Close this workspace</h3>
        {status.scheduledFor ? (
          <>
            <p role="status" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm" data-testid="deletion-scheduled">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span>
                This workspace will be erased on <strong>{formatDayLong(status.scheduledFor.slice(0, 10))}</strong> ({status.daysLeft} day{status.daysLeft === 1 ? "" : "s"} left). Until then everything works as usual and nothing is lost.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={cancelClose} disabled={!isOwner || busy}>Cancel closing</Button>
              {!isOwner && <span className="text-xs text-muted-foreground">Only the owner can cancel this.</span>}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Closing erases the workspace and everything in it: documents, records, activity and team access, and your sign-in if it belongs to no other workspace. Nothing is deleted for {DELETION_GRACE_DAYS} days, and you can cancel at any point before then. Other people on your team keep their own sign-in. Download an export first.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="destructive" onClick={() => { setClosing(true); setDialogError(""); setTyped(""); }} disabled={!isOwner}>Close workspace…</Button>
              {!isOwner && <span className="text-xs text-muted-foreground">Only the owner can close the workspace.</span>}
            </div>
          </>
        )}
      </section>

      <Dialog open={closing} onOpenChange={(o) => { if (!busy) setClosing(o); }}>
        <DialogContent variant="alert">
          <DialogTitle>Close {workspaceName}?</DialogTitle>
          <DialogDescription className="mt-1">
            In {DELETION_GRACE_DAYS} days everything in this workspace will be erased for good. You can cancel any time before then. To confirm, type the workspace name: <strong>{workspaceName}</strong>
          </DialogDescription>
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) void confirmClose(); }}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the workspace name to confirm" autoComplete="off" />
            {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setClosing(false)} disabled={busy}>Keep my workspace</Button>
              <Button type="submit" variant="destructive" disabled={busy || typed.trim().toLowerCase() !== workspaceName.trim().toLowerCase()}>{busy ? "Closing…" : "Close workspace"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
