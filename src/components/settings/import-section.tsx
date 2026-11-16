"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  importFromBrowser, planMerge, removeBrowserCopies, useBrowserCopies,
  type BrowserCopy, type ImportReport,
} from "@/lib/records/import";
import { remoteList } from "@/lib/records/remote";
import { useRecordsInDatabase, type RecordKind } from "@/lib/records/storage";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What importing this service would do, in words. */
function describe(copy: BrowserCopy): { text: string; canImport: boolean } {
  const { add, alreadyThere } = planMerge(copy, remoteList(copy.service.kind));
  const notes: string[] = [];
  if (copy.service.single) {
    notes.push(add > 0 ? "Will be saved to your workspace" : "Your workspace already has these, so they are not replaced");
  } else {
    notes.push(add > 0 ? `${plural(add, "record", "records")} to add` : "Nothing new to add");
    if (alreadyThere > 0) notes.push(`${plural(alreadyThere, "record is", "records are")} already in your workspace and stay as they are`);
  }
  if (copy.sample > 0) notes.push(`${plural(copy.sample, "sample record", "sample records")} skipped`);
  if (copy.tooLarge > 0) notes.push(`${plural(copy.tooLarge, "record", "records")} too large to save, skipped`);
  return { text: notes.join(". ") + ".", canImport: add > 0 };
}

function reportLine(r: ImportReport): { ok: boolean; text: string } {
  if (r.problem === "denied") return { ok: false, text: "You have view-only access to this workspace, so nothing was imported." };
  if (r.problem === "failed") return { ok: false, text: "We could not save these yet. They will keep trying; check back in a moment." };
  if (r.service.single) return { ok: true, text: r.added > 0 ? "Saved to your workspace." : "Your workspace already had these, so nothing was changed." };
  return { ok: true, text: r.added > 0 ? `${plural(r.added, "record", "records")} added.` : "Nothing new to add." };
}

/**
 * Brings records that this browser still holds from before the database was connected into the workspace, when the
 * person chooses. It never overwrites what the workspace already has and never imports the built-in sample records.
 */
export function ImportSection() {
  const inDatabase = useRecordsInDatabase();
  const copies = useBrowserCopies();
  // Until the person changes it, every service that has something new to add is ticked.
  const [picked, setPicked] = useState<Set<RecordKind> | null>(null);
  const selected = picked ?? new Set((copies ?? []).filter((c) => describe(c).canImport).map((c) => c.service.kind));
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<ImportReport[] | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async () => {
    setBusy(true);
    setConfirmRemove(false);
    try {
      setReports(await importFromBrowser([...selected]));
    } finally {
      setBusy(false);
      setPicked(null);
    }
  };

  const toggle = (kind: RecordKind) => { const n = new Set(selected); if (n.has(kind)) n.delete(kind); else n.add(kind); setPicked(n); };
  const removable = (reports ?? []).filter((r) => r.problem === null).map((r) => r.service.kind);

  return (
    <section aria-label="Import from this browser" className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
      {!inDatabase ? (
        <p className="text-sm text-muted-foreground">
          This is the preview, which keeps everything in this browser. Sign in to a workspace to import records into it.
        </p>
      ) : copies === null ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">Looking at what this browser holds…</p>
      ) : copies.length === 0 && !reports ? (
        <p data-testid="import-empty" className="text-sm text-muted-foreground">
          Nothing to import. This browser holds no older records outside your workspace.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Before your workspace was connected to the database, records were kept in this browser. They are still here, but your
            workspace does not show them. Choose what to bring across. Nothing in your workspace is replaced: if a record is
            in both places, the workspace&apos;s copy stays. The built-in sample records and the activity log are never imported.
          </p>
          <ul className="divide-y rounded-xl border">
            {(copies ?? []).map((c) => {
              const d = describe(c);
              const id = `import-${c.service.kind}`;
              return (
                <li key={c.service.kind} data-testid={id} className="flex items-start gap-3 p-3">
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-primary"
                    checked={selected.has(c.service.kind) && d.canImport}
                    disabled={!d.canImport || busy}
                    onChange={() => toggle(c.service.kind)}
                  />
                  <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-medium">{c.service.label}</span>
                    <span className="block text-xs text-muted-foreground">{d.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button data-testid="import-run" disabled={busy || selected.size === 0 || !(copies ?? []).some((c) => selected.has(c.service.kind) && describe(c).canImport)} onClick={run}>
              <Download className="size-4" aria-hidden /> {busy ? "Importing…" : "Import selected"}
            </Button>
          </div>
        </>
      )}

      {reports && (
        <div data-testid="import-result" role="status" className="space-y-2 rounded-xl border bg-muted/40 p-3">
          <p className="text-sm font-medium">Import finished</p>
          <ul className="space-y-1">
            {reports.map((r) => {
              const line = reportLine(r);
              const Icon = line.ok ? CheckCircle2 : AlertTriangle;
              return (
                <li key={r.service.kind} className="flex items-start gap-2 text-sm">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${line.ok ? "text-emerald-600" : "text-amber-600"}`} aria-hidden />
                  <span><span className="font-medium">{r.service.label}:</span> {line.text}</span>
                </li>
              );
            })}
          </ul>
          {removable.length > 0 && (
            <div className="pt-1">
              {!confirmRemove ? (
                <Button data-testid="import-remove" variant="outline" size="sm" onClick={() => setConfirmRemove(true)}>
                  Remove the old copies from this browser
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Your records are saved in the workspace. This removes only this browser&apos;s old copy and cannot be undone.</span>
                  <Button data-testid="import-remove-confirm" size="sm" onClick={() => { removeBrowserCopies(removable); setConfirmRemove(false); setReports(null); setPicked(null); }}>Remove</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>Keep them</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
