"use client";

import { useMemo, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IMPORT_FIELDS, TEMPLATE_CSV, contactKey, parseContact } from "@/lib/contacts/logic";
import type { Contact, ContactInput } from "@/lib/contacts/types";
import { CsvError, parseCsv, type ParsedCsv } from "@/lib/import/csv";
import { mapRows, missingRequired, suggestMapping, type Mapping } from "@/lib/import/mapping";
import { runImport, type ImportOutcome } from "@/lib/import/run";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
type Step = "input" | "map" | "review";

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Body({
  existing, onClose, onImport,
}: {
  existing: Contact[];
  onClose: () => void;
  onImport: (outcome: ImportOutcome<ContactInput>, mode: "skip" | "update") => void;
}) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [mode, setMode] = useState<"skip" | "update">("skip");

  const outcome = useMemo(() => {
    if (!parsed || step !== "review") return null;
    return runImport(
      mapRows(parsed.rows, mapping), parsed.lines, parseContact, contactKey,
      new Set(existing.map(contactKey).filter(Boolean)),
    );
  }, [parsed, mapping, step, existing]);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("That file is larger than 2 MB. Split it into smaller files."); return; }
    setText(await file.text());
    setFileName(file.name);
    setError("");
  };

  const next = () => {
    try {
      const p = parseCsv(text);
      setParsed(p);
      setMapping(suggestMapping(p.headers, IMPORT_FIELDS));
      setError("");
      setStep("map");
    } catch (e) {
      setError(e instanceof CsvError ? e.message : "That file could not be read.");
    }
  };

  const missing = missingRequired(mapping, IMPORT_FIELDS);
  const updatable = outcome ? outcome.duplicates.filter((d) => d.of === "existing").length : 0;
  const toApply = outcome ? outcome.accepted.length + (mode === "update" ? updatable : 0) : 0;

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>Import contacts</DialogTitle>
        <DialogDescription className="mt-1">
          {step === "input" && "Step 1 of 3: choose a CSV file or paste its contents."}
          {step === "map" && "Step 2 of 3: match your columns to contact fields."}
          {step === "review" && "Step 3 of 3: review what will happen before anything changes."}
        </DialogDescription>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {step === "input" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-muted">
                <FileUp className="size-4" aria-hidden /> Choose file
                <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" aria-label="Choose a CSV file" onChange={(e) => void readFile(e.target.files?.[0])} />
              </label>
              <Button type="button" variant="ghost" onClick={downloadTemplate}><Download /> Download template</Button>
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-text">Or paste CSV text</Label>
              <textarea
                id="import-text"
                rows={8}
                value={text}
                onChange={(e) => { setText(e.target.value); setFileName(""); }}
                placeholder={"Name,Email,Phone,Company\nAnn Lee,ann@example.com,555-010-1111,Acme"}
                className="flex w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
            <p className="text-xs text-muted-foreground">Up to 5,000 rows. Commas, semicolons and tabs are detected automatically. Nothing is uploaded: the file is read in your browser.</p>
          </>
        )}

        {step === "map" && parsed && (
          <>
            <p className="text-sm text-muted-foreground">{parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} found. We matched what we could; change any that look wrong.</p>
            <ul className="space-y-3">
              {IMPORT_FIELDS.map((f) => {
                const col = mapping[f.key];
                const samples = col === null || col === undefined ? [] : parsed.rows.map((r) => r[col]).filter(Boolean).slice(0, 3);
                return (
                  <li key={f.key} className="grid items-center gap-2 sm:grid-cols-[10rem_1fr]">
                    <Label htmlFor={`map-${f.key}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                    <div className="space-y-1">
                      <Select value={col === null || col === undefined ? "none" : String(col)} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === "none" ? null : Number(v) }))}>
                        <SelectTrigger id={`map-${f.key}`} aria-label={`Column for ${f.label}`} className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Don&apos;t import</SelectItem>
                          {parsed.headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {samples.length > 0 && <p className="truncate text-xs text-muted-foreground">e.g. {samples.join(" · ")}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {parsed.extraCells.length > 0 && (
              <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {parsed.extraCells.length} row{parsed.extraCells.length === 1 ? " has" : "s have"} more values than there are headers (first on line {parsed.extraCells[0].line}). The extra values are ignored.
              </p>
            )}
            {missing.length > 0 && <p role="alert" className="text-sm text-destructive">Choose a column for: {missing.map((f) => f.label).join(", ")}.</p>}
          </>
        )}

        {step === "review" && outcome && (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center" aria-label="Import summary">
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Ready to add</dt><dd className="text-2xl font-semibold" data-testid="count-accepted">{outcome.accepted.length}</dd></div>
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Already exist</dt><dd className="text-2xl font-semibold" data-testid="count-duplicates">{outcome.duplicates.length}</dd></div>
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Need fixing</dt><dd className="text-2xl font-semibold" data-testid="count-rejected">{outcome.rejected.length}</dd></div>
            </dl>
            {outcome.duplicates.length > 0 && (
              <fieldset className="space-y-1.5 rounded-xl border p-3">
                <legend className="px-1 text-sm font-medium">Matching contacts</legend>
                <p className="text-xs text-muted-foreground">{outcome.duplicates.length} row{outcome.duplicates.length === 1 ? " matches" : "s match"} someone already in the list or repeated in the file.</p>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" checked={mode === "skip"} onChange={() => setMode("skip")} className="accent-primary" /> Skip them</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" checked={mode === "update"} onChange={() => setMode("update")} className="accent-primary" /> Update existing contacts with the new values</label>
              </fieldset>
            )}
            {outcome.rejected.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Rows that will not be imported</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border bg-muted/40 p-3 text-xs" data-testid="rejected-list">
                  {outcome.rejected.slice(0, 20).map((r) => <li key={r.line}><span className="font-medium">Line {r.line}:</span> {r.errors.join("; ")}</li>)}
                </ul>
                {outcome.rejected.length > 20 && <p className="text-xs text-muted-foreground">and {outcome.rejected.length - 20} more.</p>}
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex justify-between gap-2 border-t px-5 py-3">
        <div>{step !== "input" && <Button type="button" variant="ghost" onClick={() => setStep(step === "review" ? "map" : "input")}>Back</Button>}</div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          {step === "input" && <Button type="button" onClick={next} disabled={text.trim() === ""}>Next</Button>}
          {step === "map" && <Button type="button" onClick={() => setStep("review")} disabled={missing.length > 0}>Review</Button>}
          {step === "review" && outcome && (
            <Button type="button" disabled={toApply === 0} onClick={() => { onImport(outcome, mode); onClose(); }}>
              Import {toApply} contact{toApply === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function ImportDialog({
  open, existing, onOpenChange, onImport,
}: {
  open: boolean;
  existing: Contact[];
  onOpenChange: (open: boolean) => void;
  onImport: (outcome: ImportOutcome<ContactInput>, mode: "skip" | "update") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && <Body existing={existing} onClose={() => onOpenChange(false)} onImport={onImport} />}
      </DialogContent>
    </Dialog>
  );
}
