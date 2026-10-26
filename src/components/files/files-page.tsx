"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Copy, Download, FileInput, FolderOpen, FolderTree, Pencil, ShieldCheck, Undo2, Upload } from "lucide-react";
import { downloadText } from "@/components/import/csv-source";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_FILES, parseFileList } from "@/lib/files/paths";
import { buildPlan, layoutAfter } from "@/lib/files/plan";
import { scanBrowserFiles } from "@/lib/files/scan";
import { moveScript, planToCsv, undoScript } from "@/lib/files/script";
import type { ChangeKind, FileEntry, PlanOptions, SkippedFile } from "@/lib/files/types";

const SHOWN = 200;
const KIND_LABEL: Record<ChangeKind, string> = { rename: "Rename", duplicate: "Duplicate", misplaced: "Misplaced", reorganize: "Reorganize" };
const KIND_BADGE: Record<ChangeKind, "default" | "warning" | "danger" | "success"> = { rename: "default", duplicate: "warning", misplaced: "danger", reorganize: "success" };

const bytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);
const textareaClass = "flex w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

interface LoadNotes { skipped: SkippedFile[]; unhashed: number; truncated: boolean; source: string }

/**
 * Business File Reset. Files are read in the browser and compared there; nothing is uploaded and nothing
 * on the computer is changed. The result is a reviewed plan plus scripts that only move and rename.
 */
export function FilesPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [notes, setNotes] = useState<LoadNotes | null>(null);
  const [options, setOptions] = useState<PlanOptions>({ rename: true, duplicates: true, misplaced: true, reorganize: false });
  const [off, setOff] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState("");

  const plan = useMemo(() => (files ? buildPlan(files, options) : null), [files, options]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const start = (f: FileEntry[], n: LoadNotes) => {
    setFiles(f); setNotes(n); setOff(new Set()); setApproved(false); setPasting(false);
    setNotice(`Loaded ${f.length} file${f.length === 1 ? "" : "s"} from ${n.source}.`);
  };
  const setOption = (key: keyof PlanOptions, value: boolean) => { setOptions((o) => ({ ...o, [key]: value })); setApproved(false); setOff(new Set()); };

  const chooseFolder = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setProgress({ done: 0, total: Math.min(list.length, MAX_FILES) });
    const r = await scanBrowserFiles(Array.from(list), (done, total) => setProgress({ done, total }));
    setProgress(null);
    if (r.files.length === 0) { setNotice("No files were found in that folder."); return; }
    start(r.files, { skipped: r.skipped, unhashed: r.unhashed, truncated: r.truncated, source: "your folder" });
  };

  const changes = plan?.changes ?? [];
  const selected = changes.filter((c) => !off.has(c.from));
  const count = (k: ChangeKind) => changes.filter((c) => c.reasons.some((r) => r.kind === k)).length;
  const layout = files ? layoutAfter(files, selected) : [];
  const toggle = (from: string) => { setOff((s) => { const n = new Set(s); if (n.has(from)) n.delete(from); else n.add(from); return n; }); setApproved(false); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Business File Reset</h1>
          <p className="text-sm text-muted-foreground">Find duplicates, tidy names and sort a messy folder, with a preview and your approval before anything moves.</p>
        </div>
        {files && <Button variant="outline" onClick={() => { setFiles(null); setNotes(null); setApproved(false); setNotice(""); }}>Start over</Button>}
      </div>

      {preview && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      {!files || !plan || !notes ? (
        <section aria-label="Choose files" className="space-y-4 rounded-2xl border bg-card p-6 shadow-panel">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-sm text-muted-foreground">Files are read in your browser to compare them. <strong className="text-foreground">Nothing is uploaded, and nothing on your computer is changed or deleted.</strong> You get a plan and a script you run yourself.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <FolderOpen className="size-4" aria-hidden /> Choose a folder
              <input type="file" multiple className="sr-only" aria-label="Choose a folder" onChange={(e) => { void chooseFolder(e.target.files); e.target.value = ""; }} {...({ webkitdirectory: "" } as Record<string, string>)} />
            </label>
            <Button variant="outline" onClick={() => setPasting((p) => !p)} aria-expanded={pasting}><FileInput /> Paste a list of files</Button>
          </div>
          {progress && (
            <div role="status" aria-label="Reading files" className="space-y-1">
              <Progress value={progress.total ? Math.round((progress.done / progress.total) * 100) : 0} />
              <p className="text-xs text-muted-foreground">Reading {progress.done} of {progress.total} files…</p>
            </div>
          )}
          {pasting && (
            <div className="space-y-2">
              <Label htmlFor="file-list">One file per line: <code>folder/name.pdf</code>, or <code>folder/name.pdf | size in bytes | date</code></Label>
              <textarea id="file-list" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className={textareaClass} placeholder={"Invoices/Invoice_03-14-2026_Acme.pdf | 52000 | 3/14/2026\nDesktop/scan_0034 .PDF\nDownloads/W-9_Initech - Copy.pdf"} />
              <p className="text-xs text-muted-foreground">Up to {MAX_FILES.toLocaleString()} files. A list has no contents to compare, so duplicates are found only from matching sizes and copy-style names like &quot;Report (1)&quot;.</p>
              <Button disabled={pasteText.trim() === ""} onClick={() => {
                const r = parseFileList(pasteText);
                if (r.files.length === 0) { setNotice("None of those lines could be used."); return; }
                start(r.files, { skipped: r.skipped, unhashed: r.files.length, truncated: r.truncated, source: "your list" });
              }}>Load list</Button>
            </div>
          )}
        </section>
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile icon={FolderTree} label={`Files (${bytes(files.reduce((n, f) => n + f.size, 0))})`} value={files.length} tone="text-primary" />
            <SummaryTile icon={Copy} label={`Duplicates${plan.duplicateBytes ? ` (${bytes(plan.duplicateBytes)})` : ""}`} value={count("duplicate")} tone="text-amber-600" />
            <SummaryTile icon={ArrowRight} label="Misplaced" value={count("misplaced") + count("reorganize")} tone="text-red-600" />
            <SummaryTile icon={Pencil} label="To rename" value={count("rename")} tone="text-sky-600" />
          </section>

          {(notes.skipped.length > 0 || notes.truncated || notes.unhashed > 0) && (
            <section aria-label="Notes" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ul className="list-disc space-y-1 pl-5">
                {notes.truncated && <li>Only the first {MAX_FILES.toLocaleString()} files were used.</li>}
                {notes.unhashed > 0 && <li>{notes.unhashed} file{notes.unhashed === 1 ? " was" : "s were"} not read (too big, or a list), so duplicates among them are only &quot;likely&quot;.</li>}
                {notes.skipped.slice(0, 5).map((s) => <li key={s.path}>Skipped {s.path}: {s.reason}.</li>)}
                {notes.skipped.length > 5 && <li>and {notes.skipped.length - 5} more skipped.</li>}
              </ul>
            </section>
          )}

          <section aria-labelledby="options-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="options-heading" className="text-base font-semibold">What should the cleanup do?</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([
                ["rename", "Standardize file names", "Dates as 2026-03-14, no underscores or stray spaces, lower-case extensions."],
                ["duplicates", "Set duplicates aside for review", "Moved to a review folder. Nothing is ever deleted."],
                ["misplaced", "Move misplaced files", "A contract sitting in Invoices goes to Contracts."],
                ["reorganize", "Sort everything into the suggested folders", "Moves every file, not only the misplaced ones."],
              ] as const).map(([key, label, hint]) => (
                <label key={key} className="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm hover:bg-muted/40">
                  <input type="checkbox" checked={options[key]} onChange={(e) => setOption(key, e.target.checked)} className="mt-0.5 size-4 rounded border-input accent-primary" />
                  <span><span className="font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="structure-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="structure-heading" className="text-base font-semibold">Folders after the cleanup</h2>
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3" data-testid="layout">
              {layout.map((l) => <li key={l.folder} className="flex justify-between gap-2"><span className="truncate">{l.folder}</span><span className="tabular-nums text-muted-foreground">{l.count}</span></li>)}
            </ul>
          </section>

          <section aria-labelledby="changes-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="changes-heading" className="text-base font-semibold">Proposed changes <span className="font-normal text-muted-foreground">({selected.length} of {changes.length} selected)</span></h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setOff(new Set()); setApproved(false); }}>Select all</Button>
                <Button size="sm" variant="outline" onClick={() => { setOff(new Set(changes.map((c) => c.from))); setApproved(false); }}>Select none</Button>
              </div>
            </div>
            {changes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing to change with these options. This folder already looks tidy.</p>
            ) : (
              <ul className="mt-2 divide-y" data-testid="changes">
                {changes.slice(0, SHOWN).map((c) => (
                  <li key={c.from} className="flex items-start gap-3 py-2.5 text-sm" data-testid="change-row">
                    <input type="checkbox" checked={!off.has(c.from)} onChange={() => toggle(c.from)} aria-label={`Apply the change to ${c.from}`} className="mt-1 size-4 shrink-0 rounded border-input accent-primary" />
                    <div className="min-w-0 space-y-1">
                      <p className="break-all"><span className="text-muted-foreground">{c.from}</span> <ArrowRight className="mx-1 inline size-3.5 text-muted-foreground" aria-hidden /> <span className="font-medium">{c.to}</span></p>
                      <p className="flex flex-wrap gap-1.5">{c.reasons.map((r, i) => <Badge key={i} variant={KIND_BADGE[r.kind]} title={r.detail}>{KIND_LABEL[r.kind]}</Badge>)}<span className="text-xs text-muted-foreground">{c.reasons.filter((r) => r.kind !== "rename").map((r) => r.detail).join(" · ")}</span></p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {changes.length > SHOWN && <p className="mt-2 text-xs text-muted-foreground">Showing the first {SHOWN} of {changes.length}. Select all or none applies to every change.</p>}
          </section>

          <section aria-labelledby="approve-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="approve-heading" className="text-base font-semibold">Approve</h2>
            {!approved ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Nothing has been changed. Approve the {selected.length} selected change{selected.length === 1 ? "" : "s"} to get the plan and scripts.</p>
                <Button disabled={selected.length === 0} onClick={() => { setApproved(true); setNotice(`Approved ${selected.length} change${selected.length === 1 ? "" : "s"}.`); }}><CheckCircle2 /> Approve {selected.length} change{selected.length === 1 ? "" : "s"}</Button>
              </div>
            ) : (
              <div className="mt-2 space-y-3" data-testid="approved">
                <p className="text-sm"><span className="font-medium">{selected.length} change{selected.length === 1 ? "" : "s"} approved.</span> Still nothing has been moved: download the files below, then run the script on the folder.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => downloadText(planToCsv(selected), `cleanup-plan-${today}.csv`)}><Download /> Plan (CSV)</Button>
                  <Button variant="outline" onClick={() => downloadText(moveScript(selected), `cleanup-${today}.sh`, "text/x-shellscript")}><Upload /> Move script (.sh)</Button>
                  <Button variant="outline" onClick={() => downloadText(undoScript(selected), `undo-cleanup-${today}.sh`, "text/x-shellscript")}><Undo2 /> Undo script (.sh)</Button>
                  <Button variant="ghost" onClick={() => setApproved(false)}>Change selection</Button>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                  <li>Back up the folder first.</li>
                  <li>On Mac or Linux, run <code className="rounded bg-muted px-1">sh cleanup-{today}.sh &quot;/path/to/the/folder&quot;</code>. On Windows use WSL or Git Bash, or follow the CSV plan by hand.</li>
                  <li>The script only moves and renames. It skips anything that is missing or would overwrite a file, and it never deletes.</li>
                  <li>To go back, run the undo script the same way.</li>
                </ol>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
