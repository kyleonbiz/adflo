"use client";

import { useMemo, useState } from "react";
import { CsvSource, useCsvInput } from "@/components/import/csv-source";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { suggestColumns, validateDataset } from "@/lib/datasets/logic";
import type { Column, ColumnType, Dataset } from "@/lib/datasets/types";
import { CsvError, parseCsv, type ParsedCsv } from "@/lib/import/csv";
import type { ImportOutcome } from "@/lib/import/run";
import type { Cell } from "@/lib/datasets/types";

type Step = "input" | "columns" | "review";
const TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" }, { value: "number", label: "Number" }, { value: "date", label: "Date" },
];

export interface LoadedData { dataset: Dataset; outcome: ImportOutcome<Cell[]> }

function Body({ onClose, onLoad }: { onClose: () => void; onLoad: (loaded: LoadedData) => void }) {
  const input = useCsvInput();
  const { error, setError } = input;
  const [step, setStep] = useState<Step>("input");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [name, setName] = useState("Imported data");
  const [dedupe, setDedupe] = useState(true);

  const outcome = useMemo(() => (parsed && step === "review" ? validateDataset(parsed, columns, dedupe) : null), [parsed, columns, dedupe, step]);

  const next = () => {
    try {
      const p = parseCsv(input.text);
      setParsed(p);
      setColumns(suggestColumns(p));
      if (input.fileName) setName(input.fileName.replace(/\.[^.]+$/, "").slice(0, 60) || "Imported data");
      setError("");
      setStep("columns");
    } catch (e) {
      setError(e instanceof CsvError ? e.message : "That file could not be read.");
    }
  };
  const setColumn = (i: number, change: Partial<Column>) => setColumns((cs) => cs.map((c, j) => (j === i ? { ...c, ...change } : c)));

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>Import data</DialogTitle>
        <DialogDescription className="mt-1">
          {step === "input" && "Step 1 of 3: choose a CSV file or paste its contents."}
          {step === "columns" && "Step 2 of 3: check each column's type and mark the ones that must be filled in."}
          {step === "review" && "Step 3 of 3: review the result before loading it."}
        </DialogDescription>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {step === "input" && <CsvSource input={input} placeholder={"Date,Vendor,Amount\n03/14/2026,Acme,$1,200.00"} />}

        {step === "columns" && parsed && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="data-name">Name for this data</Label>
              <Input id="data-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">{parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} found. Types were guessed from the values.</p>
            <ul className="space-y-3">
              {columns.map((c, i) => {
                const samples = parsed.rows.map((r) => r[i]).filter(Boolean).slice(0, 3);
                return (
                  <li key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_9rem_auto]" data-testid="column-row">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      {samples.length > 0 && <p className="truncate text-xs text-muted-foreground">e.g. {samples.join(" · ")}</p>}
                    </div>
                    <Select value={c.type} onValueChange={(v) => setColumn(i, { type: v as ColumnType })}>
                      <SelectTrigger aria-label={`Type of ${c.name}`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={c.required} onChange={(e) => setColumn(i, { required: e.target.checked })} aria-label={`${c.name} is required`} className="size-4 rounded border-input accent-primary" />
                      Required
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {step === "review" && outcome && (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center" aria-label="Import summary">
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Ready</dt><dd className="text-2xl font-semibold" data-testid="count-accepted">{outcome.accepted.length}</dd></div>
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Repeated rows</dt><dd className="text-2xl font-semibold" data-testid="count-duplicates">{outcome.duplicates.length}</dd></div>
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Need fixing</dt><dd className="text-2xl font-semibold" data-testid="count-rejected">{outcome.rejected.length}</dd></div>
            </dl>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} className="size-4 rounded border-input accent-primary" />
              Remove rows that exactly repeat an earlier row
            </label>
            {outcome.rejected.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Rows that will not be loaded</p>
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
        <div>{step !== "input" && <Button type="button" variant="ghost" onClick={() => setStep(step === "review" ? "columns" : "input")}>Back</Button>}</div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          {step === "input" && <Button type="button" onClick={next} disabled={input.text.trim() === ""}>Next</Button>}
          {step === "columns" && <Button type="button" onClick={() => setStep("review")} disabled={name.trim() === ""}>Review</Button>}
          {step === "review" && outcome && (
            <Button
              type="button"
              disabled={outcome.accepted.length === 0}
              onClick={() => {
                onLoad({ dataset: { name: name.trim(), columns, rows: outcome.accepted.map((a) => a.value) }, outcome });
                onClose();
              }}
            >
              Load {outcome.accepted.length} row{outcome.accepted.length === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function DataImportDialog({
  open, onOpenChange, onLoad,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (loaded: LoadedData) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && <Body onClose={() => onOpenChange(false)} onLoad={onLoad} />}
      </DialogContent>
    </Dialog>
  );
}
