"use client";

import { useMemo, useState } from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvSource, downloadText, useCsvInput } from "@/components/import/csv-source";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toCsv } from "@/lib/csv";
import { IMPORT_FIELDS, TEMPLATE_CSV, applyCategoryMap, contactKeys, keyIndex, parseContact, unknownCategories, updateChanges } from "@/lib/contacts/logic";
import { CONTACT_CATEGORIES, type Contact, type ContactCategory, type ContactInput } from "@/lib/contacts/types";
import { CsvError, parseCsv, type ParsedCsv } from "@/lib/import/csv";
import { mapRows, missingRequired, suggestMapping, type Mapping } from "@/lib/import/mapping";
import { runImport, type ImportOutcome } from "@/lib/import/run";

type Step = "input" | "map" | "review";
const STEPS: { id: Step; label: string }[] = [{ id: "input", label: "Choose file" }, { id: "map", label: "Match columns" }, { id: "review", label: "Review" }];
const FIELD_LABEL: Record<string, string> = { name: "name", email: "email", phone: "phone", company: "company", notes: "notes", lastContacted: "last contacted", category: "category" };
const REJECT_SHOWN = 100;
const MATCH_SHOWN = 50;

function Body({
  existing, onClose, onImport,
}: {
  existing: Contact[];
  onClose: () => void;
  onImport: (outcome: ImportOutcome<ContactInput>, mode: "skip" | "update") => void;
}) {
  const [step, setStep] = useState<Step>("input");
  const input = useCsvInput();
  const { error, setError } = input;
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [categoryChoices, setCategoryChoices] = useState<Record<string, ContactCategory>>({});

  const categoryCol = mapping.category;
  const unknown = useMemo(
    () => (parsed && categoryCol !== null && categoryCol !== undefined ? unknownCategories(parsed.rows.map((r) => r[categoryCol] ?? "")) : []),
    [parsed, categoryCol],
  );

  const outcome = useMemo(() => {
    if (!parsed || step !== "review") return null;
    const choices = Object.fromEntries(unknown.map((v) => [v.toLowerCase(), categoryChoices[v.toLowerCase()] ?? "Other"]));
    return runImport(
      applyCategoryMap(mapRows(parsed.rows, mapping), choices), parsed.lines, parseContact, contactKeys,
      new Set(existing.flatMap(contactKeys)),
    );
  }, [parsed, mapping, step, existing, unknown, categoryChoices]);

  const matches = useMemo(() => {
    if (!outcome) return [];
    const index = keyIndex(existing);
    return outcome.duplicates.map((d) => {
      const target = d.of === "existing" ? index.get(d.key) : undefined;
      return { line: d.line, name: d.value.name, of: d.of, target, changes: target ? Object.keys(updateChanges(target, d.value, d.key)) : [] };
    });
  }, [outcome, existing]);

  const preview = useMemo(
    () => (parsed ? mapRows(parsed.rows.slice(0, 3), mapping) : []),
    [parsed, mapping],
  );

  const next = () => {
    try {
      const p = parseCsv(input.text);
      setParsed(p);
      setMapping(suggestMapping(p.headers, IMPORT_FIELDS));
      setCategoryChoices({});
      setError("");
      setStep("map");
    } catch (e) {
      setError(e instanceof CsvError ? e.message : "That file could not be read.");
    }
  };

  const missing = missingRequired(mapping, IMPORT_FIELDS);
  const updatable = matches.filter((m) => m.of === "existing").length;
  const inFile = matches.length - updatable;
  const stepIndex = STEPS.findIndex((x) => x.id === step);
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
        <ol aria-label="Progress" className="mt-3 flex items-center gap-2 text-xs">
          {STEPS.map((x, i) => (
            <li key={x.id} aria-current={i === stepIndex ? "step" : undefined} className={`flex items-center gap-1.5 ${i === stepIndex ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              <span className={`flex size-5 items-center justify-center rounded-full border text-[11px] ${i < stepIndex ? "border-primary bg-primary text-primary-foreground" : i === stepIndex ? "border-primary text-primary" : ""}`}>
                {i < stepIndex ? <Check className="size-3" aria-hidden /> : i + 1}
              </span>
              <span className="hidden sm:inline">{x.label}</span>
              {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-4 bg-border sm:w-8" />}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {step === "input" && (
          <CsvSource
            input={input}
            placeholder={"Name,Email,Phone,Company\nAnn Lee,ann@example.com,555-010-1111,Acme"}
            onTemplate={() => downloadText(TEMPLATE_CSV, "contacts-template.csv")}
          />
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
                          <SelectItem value="none">Don&apos;t Import</SelectItem>
                          {parsed.headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {samples.length > 0 && <p className="truncate text-xs text-muted-foreground">e.g. {samples.join(" · ")}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {unknown.length > 0 && (
              <fieldset className="space-y-2 rounded-xl border p-3">
                <legend className="px-1 text-sm font-medium">Category values we don&apos;t recognise</legend>
                <p className="text-xs text-muted-foreground">Pick where each one should go. Nothing is rejected for this.</p>
                {unknown.map((v) => (
                  <div key={v} className="grid items-center gap-2 sm:grid-cols-[10rem_1fr]">
                    <Label htmlFor={`cat-${v}`} className="truncate">&ldquo;{v}&rdquo;</Label>
                    <Select value={categoryChoices[v.toLowerCase()] ?? "Other"} onValueChange={(c) => setCategoryChoices((m) => ({ ...m, [v.toLowerCase()]: c as ContactCategory }))}>
                      <SelectTrigger id={`cat-${v}`} aria-label={`Category for ${v}`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONTACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </fieldset>
            )}
            {missing.length === 0 && preview.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Preview of the first {preview.length} row{preview.length === 1 ? "" : "s"}</p>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground"><tr>{IMPORT_FIELDS.filter((f) => mapping[f.key] != null).map((f) => <th key={f.key} className="whitespace-nowrap px-3 py-1.5 font-medium">{f.label}</th>)}</tr></thead>
                    <tbody className="divide-y">
                      {preview.map((r, i) => <tr key={i}>{IMPORT_FIELDS.filter((f) => mapping[f.key] != null).map((f) => <td key={f.key} className="max-w-40 truncate whitespace-nowrap px-3 py-1.5">{r[f.key] || "—"}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Matches</dt><dd className="text-2xl font-semibold" data-testid="count-duplicates">{outcome.duplicates.length}</dd></div>
              <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Need fixing</dt><dd className="text-2xl font-semibold" data-testid="count-rejected">{outcome.rejected.length}</dd></div>
            </dl>
            {matches.length > 0 && (
              <fieldset className="space-y-1.5 rounded-xl border p-3">
                <legend className="px-1 text-sm font-medium">Matching contacts</legend>
                <p className="text-xs text-muted-foreground">
                  {updatable} already in your list{inFile > 0 && `, ${inFile} repeated in the file`}. Matches use email, phone, or name and company.
                </p>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" checked={mode === "skip"} onChange={() => setMode("skip")} className="accent-primary" /> Skip them</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" checked={mode === "update"} onChange={() => setMode("update")} className="accent-primary" /> Update existing contacts with the new values</label>
                <details className="pt-1 text-xs">
                  <summary className="cursor-pointer font-medium text-primary">See which rows match</summary>
                  <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto" data-testid="match-list">
                    {matches.slice(0, MATCH_SHOWN).map((m) => (
                      <li key={m.line}>
                        <span className="font-medium">Line {m.line}:</span> {m.name} —{" "}
                        {m.target ? (
                          <>matches {m.target.name}{mode === "update" ? (m.changes.length > 0 ? `; would change ${m.changes.map((c) => FIELD_LABEL[c] ?? c).join(", ")}` : "; nothing new to add") : "; skipped"}</>
                        ) : "repeats an earlier row in the file; skipped"}
                      </li>
                    ))}
                  </ul>
                  {matches.length > MATCH_SHOWN && <p className="mt-1 text-muted-foreground">and {matches.length - MATCH_SHOWN} more.</p>}
                </details>
              </fieldset>
            )}
            {outcome.accepted.length > 0 && (
              <details className="rounded-xl border p-3 text-xs">
                <summary className="cursor-pointer text-sm font-medium">New contacts to add</summary>
                <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                  {outcome.accepted.slice(0, 50).map((a) => <li key={a.line}><span className="font-medium">{a.value.name}</span>{[a.value.company, a.value.email].filter(Boolean).length > 0 && <span className="text-muted-foreground"> · {[a.value.company, a.value.email].filter(Boolean).join(" · ")}</span>}</li>)}
                </ul>
                {outcome.accepted.length > 50 && <p className="mt-1 text-muted-foreground">and {outcome.accepted.length - 50} more.</p>}
              </details>
            )}
            {outcome.rejected.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Rows that will not be imported</p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => downloadText(toCsv([["Line", "Problems"], ...outcome.rejected.map((r) => [r.line, r.errors.join("; ")])]), "import-problems.csv")}>
                    <Download /> Download all {outcome.rejected.length}
                  </Button>
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border bg-muted/40 p-3 text-xs" data-testid="rejected-list">
                  {outcome.rejected.slice(0, REJECT_SHOWN).map((r) => <li key={r.line}><span className="font-medium">Line {r.line}:</span> {r.errors.join("; ")}</li>)}
                </ul>
                {outcome.rejected.length > REJECT_SHOWN && <p className="text-xs text-muted-foreground">and {outcome.rejected.length - REJECT_SHOWN} more. Download the list to see them all.</p>}
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
          {step === "input" && <Button type="button" onClick={next} disabled={input.text.trim() === ""}>Next</Button>}
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
