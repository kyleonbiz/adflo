"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BarChart3, CalendarClock, ChevronLeft, ChevronRight, Columns3, Database, Download, FileSpreadsheet, Rows3, Search, Upload } from "lucide-react";
import { downloadText } from "@/components/import/csv-source";
import { SummaryTile } from "@/components/modules/summary-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDayLong } from "@/lib/dates";
import {
  aggregateLabel, columnStats, datasetToCsv, displayCell, groupReport, money, needsDecimals, nextSummaryDate, reportToCsv, summaryText, viewRecords,
  type Aggregate, type Frequency, type RecordSort,
} from "@/lib/datasets/logic";
import type { Dataset } from "@/lib/datasets/types";
import { datasetToXlsx } from "@/lib/datasets/xlsx";
import { DataImportDialog, type LoadedData } from "./data-import-dialog";

const PAGE_ROWS = 100;
const REPORT_GROUPS = 25;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "data";

function downloadXlsx(bytes: Uint8Array, name: string) {
  const copy = new Uint8Array(bytes); // a plain ArrayBuffer-backed copy for Blob
  const url = URL.createObjectURL(new Blob([copy], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // revoking at once can cancel the download in some browsers
}

interface SetAside { rejected: LoadedData["outcome"]["rejected"]; repeated: number; csv: string }

/**
 * Reports on a file the visitor imports. The loaded data lives in this component's state, so nothing
 * here is saved between visits, and scheduled summaries are previewed but not sent.
 */
export function CustomDataReport({ today }: { today: string }) {
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
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RecordSort | null>(null);
  const [page, setPage] = useState(0);

  // Derived from the dataset only, so typing in the email box or paging records never recomputes them.
  const report = useMemo(() => (dataset ? groupReport(dataset, groupBy, measure, aggregate) : []), [dataset, groupBy, measure, aggregate]);
  const stats = useMemo(() => (dataset ? dataset.columns.map((_c, i) => columnStats(dataset, i)) : []), [dataset]);
  const fixedCols = useMemo(() => (dataset ? dataset.columns.map((_c, i) => needsDecimals(dataset, i)) : []), [dataset]);
  // The search box stays instant; filtering a big dataset catches up between keystrokes.
  const deferredQuery = useDeferredValue(query);
  const records = useMemo(() => (dataset ? viewRecords(dataset, deferredQuery, sort) : []), [dataset, deferredQuery, sort]);
  const recordsBox = useRef<HTMLDivElement>(null);
  useEffect(() => { recordsBox.current?.scrollTo({ top: 0 }); }, [page, deferredQuery, sort, dataset]);
  const summary = useMemo(() => (dataset && today ? summaryText(dataset, today) : ""), [dataset, today]);

  const load = ({ dataset: d, outcome, rejectedCsv }: LoadedData) => {
    const firstNumber = d.columns.findIndex((c) => c.type === "number");
    const firstText = d.columns.findIndex((c) => c.type === "text");
    setDataset(d);
    setGroupBy(firstText >= 0 ? firstText : 0);
    setMeasure(firstNumber >= 0 ? firstNumber : null);
    setAggregate("sum");
    setShowSummary(false);
    setShowAllGroups(false);
    setQuery("");
    setSort(null);
    setPage(0);
    setSetAside({ rejected: outcome.rejected, repeated: outcome.duplicates.length, csv: rejectedCsv });
    setNotice(`Loaded ${d.rows.length} row${d.rows.length === 1 ? "" : "s"} into "${d.name}". ${outcome.rejected.length} need fixing, ${outcome.duplicates.length} repeated.`);
  };

  const numberCols = dataset ? dataset.columns.map((c, i) => ({ c, i })).filter((x) => x.c.type === "number") : [];
  const blanks = stats.reduce((n, s) => n + s.blank, 0);
  const shownGroups = showAllGroups ? report : report.slice(0, REPORT_GROUPS);
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_ROWS));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * PAGE_ROWS;
  const pageRows = records.slice(pageStart, pageStart + PAGE_ROWS);
  const sortBy = (column: number) => {
    setPage(0);
    setSort((s) => (s?.column !== column ? { column, direction: "asc" } : s.direction === "asc" ? { column, direction: "desc" } : null));
  };
  const maxValue = Math.max(0, ...report.map((r) => r.value));
  const emailOk = EMAIL.test(email.trim());
  const nextDate = nextSummaryDate(today, frequency);
  const aggLabel = dataset ? aggregateLabel(dataset, measure, aggregate) : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">Turn a raw spreadsheet into clean records, summaries and reports.</p>
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
          <section aria-label="Summary" className={`grid grid-cols-2 gap-3 ${numberCols.length > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            <SummaryTile icon={Rows3} label="Rows" value={dataset.rows.length} tone="text-primary" />
            <SummaryTile icon={Columns3} label="Columns" value={dataset.columns.length} tone="text-sky-600" />
            <SummaryTile icon={Database} label="Blank cells" value={blanks} tone="text-amber-600" />
            {numberCols[0] && <SummaryTile icon={BarChart3} label={`Total ${numberCols[0].c.name}`} value={money(stats[numberCols[0].i].sum ?? 0)} tone="text-emerald-600" />}
          </section>

          {setAside && (setAside.rejected.length > 0 || setAside.repeated > 0) && (
            <section aria-labelledby="aside-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="aside-heading" className="font-semibold">Rows set aside</h2>
                {setAside.rejected.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => downloadText(setAside.csv, `rows-to-fix-${slug(dataset.name)}-${today}.csv`)}><Download /> Download rows to fix</Button>
                )}
              </div>
              <p className="mt-1">{setAside.rejected.length} row{setAside.rejected.length === 1 ? "" : "s"} could not be loaded and {setAside.repeated} repeated row{setAside.repeated === 1 ? " was" : "s were"} removed.</p>
              {setAside.rejected.length > 0 && (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs" data-testid="set-aside-list">
                  {setAside.rejected.map((r) => <li key={r.line}><span className="font-medium">Line {r.line}:</span> {r.errors.join("; ")}</li>)}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="columns-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="columns-heading" className="text-base font-semibold">{dataset.name}: columns</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="py-1.5 pr-3 font-medium">Column</th><th className="pr-3 font-medium">Type</th><th className="hidden pr-3 font-medium sm:table-cell">Filled</th><th className="hidden pr-3 font-medium sm:table-cell">Blank</th><th className="font-medium">Details</th></tr>
                </thead>
                <tbody className="divide-y">
                  {dataset.columns.map((c, i) => {
                    const s = stats[i];
                    const details = c.type === "number" && s.sum !== undefined
                      ? `Total ${money(s.sum)} · average ${money(s.avg!)} · ${money(s.min as number)} to ${money(s.max as number)}`
                      : c.type === "date" && s.min ? `${formatDayLong(s.min as string)} to ${formatDayLong(s.max as string)}`
                      : `${s.distinct} distinct`;
                    return (
                      <tr key={c.name} data-testid="column-stat">
                        <td className="max-w-[10rem] break-words py-1.5 pr-3 align-top font-medium">{c.name}{c.required && <span className="text-destructive"> *</span>}</td>
                        <td className="py-1.5 pr-3 align-top capitalize">{c.type}</td>
                        <td className="hidden pr-3 tabular-nums sm:table-cell">{s.filled}</td><td className="hidden pr-3 tabular-nums sm:table-cell">{s.blank}</td>
                        <td className="py-1.5 align-top text-muted-foreground">{details}<span className="block text-xs sm:hidden">{s.filled} filled · {s.blank} blank</span></td>
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
                <Select value={String(groupBy)} onValueChange={(v) => { setGroupBy(Number(v)); setShowAllGroups(false); }}>
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
              {shownGroups.map((r) => (
                <li key={r.group} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,10rem)_1fr_auto]" data-testid="report-row">
                  <span className="order-1 truncate font-medium" title={r.group}>{r.group}</span>
                  <span className="order-3 col-span-2 h-3 rounded-full bg-secondary sm:order-2 sm:col-span-1" aria-hidden>
                    <span className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-brand-violet" style={{ width: `${maxValue > 0 ? Math.max(0, (r.value / maxValue) * 100) : 0}%` }} />
                  </span>
                  <span className="order-2 text-right tabular-nums sm:order-3">{money(r.value)} <span className="text-xs text-muted-foreground">({r.rows} row{r.rows === 1 ? "" : "s"})</span></span>
                </li>
              ))}
            </ul>
            {report.length > REPORT_GROUPS && (
              <Button size="sm" variant="ghost" className="mt-2" aria-expanded={showAllGroups} onClick={() => setShowAllGroups((v) => !v)}>
                {showAllGroups ? `Show top ${REPORT_GROUPS}` : `Show all ${report.length} groups`}
              </Button>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{aggLabel} by {dataset.columns[groupBy].name}{report.length > REPORT_GROUPS && !showAllGroups ? ` (top ${REPORT_GROUPS} of ${report.length}; the download has all)` : ""}</p>
              <Button size="sm" variant="outline" onClick={() => downloadText(reportToCsv(dataset, groupBy, measure, aggregate), `report-${slug(dataset.name)}-${today}.csv`)}><Download /> Download report</Button>
            </div>
          </section>

          <section aria-labelledby="records-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="records-heading" className="text-base font-semibold">Records</h2>
                <p className="text-xs text-muted-foreground" data-testid="records-count">
                  {records.length === 0
                    ? "No rows match"
                    : query.trim() !== ""
                      ? `${records.length} of ${dataset.rows.length} rows match`
                      : `${dataset.rows.length} row${dataset.rows.length === 1 ? "" : "s"}`}
                  {records.length > PAGE_ROWS && ` · showing ${pageStart + 1} to ${pageStart + pageRows.length}`}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Search records" type="search" className="pl-9" placeholder="Search records" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
              </div>
            </div>
            <div ref={recordsBox} className="mt-2 max-h-96 overflow-auto rounded-xl border">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="sticky top-0 bg-muted text-xs">
                  <tr>
                    {dataset.columns.map((c, i) => {
                      const active = sort?.column === i ? sort.direction : null;
                      return (
                        <th key={c.name} scope="col" aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"} className={`font-medium ${c.type === "number" ? "text-right" : ""}`}>
                          <button type="button" onClick={() => sortBy(i)} className={`flex w-full max-w-[16rem] items-center gap-1 px-3 py-2 hover:bg-secondary ${c.type === "number" ? "ml-auto justify-end" : ""}`} aria-label={`Sort by ${c.name}`}>
                            <span className="truncate" title={c.name}>{c.name}</span>
                            {active === "asc" && <ArrowUp className="size-3" aria-hidden />}
                            {active === "desc" && <ArrowDown className="size-3" aria-hidden />}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageRows.map((row, r) => (
                    <tr key={pageStart + r} data-testid="record-row">
                      {row.map((cell, i) => {
                        const shown = displayCell(cell, dataset.columns[i].type, fixedCols[i]);
                        return <td key={i} title={shown.length > 40 ? shown : undefined} className={`max-w-[16rem] truncate px-3 py-1.5 ${dataset.columns[i].type === "number" ? "text-right tabular-nums" : ""}`}>{shown}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Page {currentPage + 1} of {pageCount}</span>
                <Button size="sm" variant="outline" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
                <Button size="sm" variant="outline" aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
              </div>
            )}
          </section>

          <section aria-labelledby="schedule-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
            <h2 id="schedule-heading" className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="size-4 text-primary" aria-hidden /> Scheduled summary <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">Preview only</span></h2>
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
              <Button size="sm" variant="outline" onClick={() => downloadText(summary, `summary-${slug(dataset.name)}-${today}.txt`, "text/plain")}><Download /> Download summary</Button>
            </div>
            {showSummary && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs" data-testid="summary-preview">{summary}</pre>}
          </section>
        </>
      )}

      <DataImportDialog open={importing} onOpenChange={setImporting} onLoad={load} />
    </div>
  );
}
