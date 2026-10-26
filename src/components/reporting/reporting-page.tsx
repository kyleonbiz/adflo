"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarClock, Columns3, Database, Download, FileSpreadsheet, Rows3, Upload } from "lucide-react";
import { downloadText } from "@/components/import/csv-source";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayLong } from "@/lib/dates";
import {
  columnStats, datasetToCsv, displayCell, groupReport, money, needsDecimals, nextSummaryDate, reportToCsv, summaryText,
  type Aggregate, type Frequency,
} from "@/lib/datasets/logic";
import type { Dataset } from "@/lib/datasets/types";
import { datasetToXlsx } from "@/lib/datasets/xlsx";
import { DataImportDialog, type LoadedData } from "./data-import-dialog";

const PREVIEW_ROWS = 100;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "data";

function downloadXlsx(bytes: Uint8Array, name: string) {
  const copy = new Uint8Array(bytes); // a plain ArrayBuffer-backed copy for Blob
  const url = URL.createObjectURL(new Blob([copy], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface SetAside { rejected: LoadedData["outcome"]["rejected"]; repeated: number }

/**
 * Data Entry & Reporting. The loaded data lives in this component's state, so nothing here is saved
 * between visits, and scheduled summaries are previewed but not sent.
 */
export function ReportingPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [setAside, setSetAside] = useState<SetAside | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [groupBy, setGroupBy] = useState(0);
  const [measure, setMeasure] = useState<number | null>(null);
  const [aggregate, setAggregate] = useState<Aggregate>("sum");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [email, setEmail] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const report = useMemo(() => (dataset ? groupReport(dataset, groupBy, measure, aggregate) : []), [dataset, groupBy, measure, aggregate]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const load = ({ dataset: d, outcome }: LoadedData) => {
    const firstNumber = d.columns.findIndex((c) => c.type === "number");
    const firstText = d.columns.findIndex((c) => c.type === "text");
    setDataset(d);
    setGroupBy(firstText >= 0 ? firstText : 0);
    setMeasure(firstNumber >= 0 ? firstNumber : null);
    setAggregate("sum");
    setShowSummary(false);
    setSetAside({ rejected: outcome.rejected, repeated: outcome.duplicates.length });
    setNotice(`Loaded ${d.rows.length} row${d.rows.length === 1 ? "" : "s"} into "${d.name}". ${outcome.rejected.length} need fixing, ${outcome.duplicates.length} repeated.`);
  };

  const fixedCols = dataset ? dataset.columns.map((_c, i) => needsDecimals(dataset, i)) : [];
  const numberCols = dataset ? dataset.columns.map((c, i) => ({ c, i })).filter((x) => x.c.type === "number") : [];
  const blanks = dataset ? dataset.columns.reduce((n, _c, i) => n + columnStats(dataset, i).blank, 0) : 0;
  const maxValue = Math.max(0, ...report.map((r) => r.value));
  const emailOk = EMAIL.test(email.trim());
  const nextDate = nextSummaryDate(today, frequency);
  const measureName = measure === null ? null : dataset!.columns[measure].name;
  const aggLabel = measure === null || aggregate === "count" ? "Rows" : aggregate === "sum" ? `Total ${measureName}` : `Average ${measureName}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Entry &amp; Reporting</h1>
          <p className="text-sm text-muted-foreground">Turn a raw spreadsheet into clean records, summaries and reports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button>
          {dataset && (
            <>
              <Button variant="outline" onClick={() => downloadText(datasetToCsv(dataset), `${slug(dataset.name)}-${today}.csv`)}><Download /> Export CSV</Button>
              <Button variant="outline" onClick={() => downloadXlsx(datasetToXlsx(dataset), `${slug(dataset.name)}-${today}.xlsx`)}><FileSpreadsheet /> Export Excel</Button>
            </>
          )}
        </div>
      </div>

      {preview && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      {!dataset ? (
        <section aria-label="Get started" className="rounded-2xl border border-dashed bg-card/60 p-10 text-center">
          <Database className="mx-auto size-8 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">No data loaded</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Import a CSV exported from a spreadsheet or another system. We check every row, set aside the ones with problems and let you report on the rest.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setImporting(true)}><Upload /> Import CSV</Button>
          </div>
        </section>
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile icon={Rows3} label="Rows" value={dataset.rows.length} tone="text-primary" />
            <SummaryTile icon={Columns3} label="Columns" value={dataset.columns.length} tone="text-sky-600" />
            <SummaryTile icon={Database} label="Blank cells" value={blanks} tone="text-amber-600" />
            {numberCols[0] ? (
              <SummaryTile icon={BarChart3} label={`Total ${numberCols[0].c.name}`} value={money(columnStats(dataset, numberCols[0].i).sum ?? 0)} tone="text-emerald-600" />
            ) : (
              <SummaryTile icon={BarChart3} label="Number columns" value={0} tone="text-emerald-600" />
            )}
          </section>

          {setAside && (setAside.rejected.length > 0 || setAside.repeated > 0) && (
            <section aria-labelledby="aside-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h2 id="aside-heading" className="font-semibold">Rows set aside</h2>
              <p className="mt-1">{setAside.rejected.length} row{setAside.rejected.length === 1 ? "" : "s"} could not be loaded and {setAside.repeated} repeated row{setAside.repeated === 1 ? " was" : "s were"} removed.</p>
              {setAside.rejected.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs" data-testid="set-aside-list">
                  {setAside.rejected.slice(0, 10).map((r) => <li key={r.line}><span className="font-medium">Line {r.line}:</span> {r.errors.join("; ")}</li>)}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="columns-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="columns-heading" className="text-base font-semibold">{dataset.name}: columns</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="py-1.5 pr-3 font-medium">Column</th><th className="pr-3 font-medium">Type</th><th className="pr-3 font-medium">Filled</th><th className="pr-3 font-medium">Blank</th><th className="font-medium">Details</th></tr>
                </thead>
                <tbody className="divide-y">
                  {dataset.columns.map((c, i) => {
                    const s = columnStats(dataset, i);
                    const details = c.type === "number" && s.sum !== undefined
                      ? `Total ${money(s.sum)} · average ${money(s.avg!)} · ${money(s.min as number)} to ${money(s.max as number)}`
                      : c.type === "date" && s.min ? `${formatDayLong(s.min as string)} to ${formatDayLong(s.max as string)}`
                      : `${s.distinct} distinct`;
                    return (
                      <tr key={c.name} data-testid="column-stat">
                        <td className="py-1.5 pr-3 font-medium">{c.name}{c.required && <span className="text-destructive"> *</span>}</td>
                        <td className="pr-3 capitalize">{c.type}</td><td className="pr-3 tabular-nums">{s.filled}</td><td className="pr-3 tabular-nums">{s.blank}</td>
                        <td className="text-muted-foreground">{details}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="report-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="report-heading" className="text-base font-semibold">Report</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="group-by">Group By</Label>
                <Select value={String(groupBy)} onValueChange={(v) => setGroupBy(Number(v))}>
                  <SelectTrigger id="group-by"><SelectValue /></SelectTrigger>
                  <SelectContent>{dataset.columns.map((c, i) => <SelectItem key={i} value={String(i)}>{c.name}{c.type === "date" ? " (By Month)" : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="measure">Measure</Label>
                <Select value={measure === null ? "rows" : String(measure)} onValueChange={(v) => setMeasure(v === "rows" ? null : Number(v))}>
                  <SelectTrigger id="measure"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rows">Count Of Rows</SelectItem>
                    {numberCols.map(({ c, i }) => <SelectItem key={i} value={String(i)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aggregate">Calculate</Label>
                <Select value={aggregate} onValueChange={(v) => setAggregate(v as Aggregate)} disabled={measure === null}>
                  <SelectTrigger id="aggregate"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Total</SelectItem><SelectItem value="avg">Average</SelectItem><SelectItem value="count">Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ul className="mt-4 space-y-2" aria-label="Report results">
              {report.map((r) => (
                <li key={r.group} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm" data-testid="report-row">
                  <span className="truncate font-medium">{r.group}</span>
                  <span className="h-3 rounded-full bg-secondary" aria-hidden>
                    <span className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-brand-violet" style={{ width: `${maxValue > 0 ? Math.max(0, (r.value / maxValue) * 100) : 0}%` }} />
                  </span>
                  <span className="tabular-nums">{money(r.value)} <span className="text-xs text-muted-foreground">({r.rows} row{r.rows === 1 ? "" : "s"})</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{aggLabel} by {dataset.columns[groupBy].name}</p>
              <Button size="sm" variant="outline" onClick={() => downloadText(reportToCsv(dataset, groupBy, measure, aggregate), `report-${slug(dataset.name)}-${today}.csv`)}><Download /> Download report</Button>
            </div>
          </section>

          <section aria-labelledby="records-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="records-heading" className="text-base font-semibold">Records</h2>
            <p className="text-xs text-muted-foreground">{dataset.rows.length > PREVIEW_ROWS ? `Showing the first ${PREVIEW_ROWS} of ${dataset.rows.length} rows. Export to get them all.` : `${dataset.rows.length} rows`}</p>
            <div className="mt-2 max-h-96 overflow-auto rounded-xl border">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="sticky top-0 bg-muted text-xs">
                  <tr>{dataset.columns.map((c) => <th key={c.name} className={`px-3 py-2 font-medium ${c.type === "number" ? "text-right" : ""}`}>{c.name}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {dataset.rows.slice(0, PREVIEW_ROWS).map((row, r) => (
                    <tr key={r} data-testid="record-row">
                      {row.map((cell, i) => <td key={i} className={`px-3 py-1.5 ${dataset.columns[i].type === "number" ? "text-right tabular-nums" : ""}`}>{displayCell(cell, dataset.columns[i].type, fixedCols[i])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="schedule-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="schedule-heading" className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="size-4 text-primary" aria-hidden /> Scheduled summary</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="frequency">How Often</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger id="frequency"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="weekly">Every Monday</SelectItem><SelectItem value="monthly">1st Of The Month</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipient">Send To</Label>
                <Input id="recipient" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-invalid={email !== "" && !emailOk} />
                {email !== "" && !emailOk && <p role="alert" className="text-xs text-destructive">Enter a valid email address</p>}
              </div>
            </div>
            <p className="mt-3 text-sm" data-testid="next-summary">
              Next summary: <span className="font-medium">{formatDayLong(nextDate)}</span>{emailOk && <> to <span className="font-medium">{email.trim()}</span></>}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Preview only: summaries are not emailed until saving and email sending are connected.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" aria-expanded={showSummary} onClick={() => setShowSummary((s) => !s)}>{showSummary ? "Hide" : "Preview"} summary</Button>
              <Button size="sm" variant="outline" onClick={() => downloadText(summaryText(dataset, today), `summary-${slug(dataset.name)}-${today}.txt`, "text/plain")}><Download /> Download summary</Button>
            </div>
            {showSummary && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs" data-testid="summary-preview">{summaryText(dataset, today)}</pre>}
          </section>
        </>
      )}

      <DataImportDialog open={importing} onOpenChange={setImporting} onLoad={load} />
    </div>
  );
}
