"use client";

import Link from "next/link";
import { Download, FileSpreadsheet, SearchX } from "lucide-react";
import { downloadText } from "@/components/import/csv-source";
import { IconSquare } from "@/components/modules/icon-square";
import { MODULE_ICONS } from "@/components/modules/module-icons";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/split-button";
import { toCsv } from "@/lib/csv";
import { datasetToXlsx } from "@/lib/datasets/xlsx";
import type { ModuleReport, ReportTone } from "@/lib/reporting/logic";
import { ReportBars } from "./report-bars";

const TONE: Record<ReportTone, string> = { neutral: "", warning: "text-amber-600", danger: "text-red-600" };
const PREVIEW_ROWS = 50;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function downloadXlsx(report: ModuleReport, name: string) {
  const bytes = datasetToXlsx({
    name: report.name,
    columns: report.table.headers.map((h) => ({ name: h, type: "text" as const, required: false })),
    rows: report.table.rows.map((r) => r.map((c) => (c === "" ? null : c))),
  });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ModuleReportView({ report, today }: { report: ModuleReport; today: string }) {
  const Icon = MODULE_ICONS[report.id];
  const file = `${slug(report.name)}-report-${today}`;

  if (report.count === 0) {
    return (
      <section aria-label={`${report.name} report`} className="rounded-2xl border border-dashed bg-card/60 p-10 text-center" data-testid="report-empty">
        <SearchX className="mx-auto size-8 text-primary" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">No {report.noun} to report on yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">This report fills in from the {report.noun} in {report.name}. Add some there and it appears here.</p>
        <Button asChild className="mt-4"><Link href={report.href}>Open {report.name}</Link></Button>
      </section>
    );
  }

  return (
    <div className="space-y-5" data-testid="module-report">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {Icon && <IconSquare icon={Icon} size="sm" />} {report.name}
          <span className="text-sm font-normal text-muted-foreground">{report.count} {report.noun}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link href={report.href}>Open {report.name}</Link></Button>
          <ExportMenu actions={[
            { label: "CSV", icon: <Download />, onSelect: () => downloadText(toCsv([report.table.headers, ...report.table.rows]), `${file}.csv`) },
            { label: "Excel", icon: <FileSpreadsheet />, onSelect: () => downloadXlsx(report, `${file}.xlsx`) },
          ]} />
        </div>
      </div>

      <section aria-label="Key numbers" className="rounded-2xl border bg-card shadow-panel">
        <dl className="grid grid-cols-2 lg:grid-cols-4 [&>div]:border-b [&>div]:p-4 lg:[&>div]:border-b-0 lg:[&>div:not(:first-child)]:border-l [&>div:nth-child(even)]:border-l lg:[&>div:nth-child(even)]:border-l">
          {report.metrics.map((m) => (
            <div key={m.label} data-testid="report-metric" className="min-w-0">
              <dt className="truncate text-xs text-muted-foreground" title={m.label}>{m.label}</dt>
              <dd className={`mt-0.5 break-words text-2xl font-semibold tabular-nums ${TONE[m.tone]}`}>{m.value}</dd>
              {m.note && <p className="mt-1 text-xs text-muted-foreground">{m.note}</p>}
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {report.breakdowns.filter((b) => b.rows.length > 0).map((b) => (
          <section key={b.title} aria-label={b.title} className="rounded-2xl border bg-card p-4 shadow-panel">
            <h3 className="mb-3 text-base font-semibold">{b.title}</h3>
            <ReportBars rows={b.rows} label={b.title} />
          </section>
        ))}
      </div>

      <section aria-label="Records" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h3 className="text-base font-semibold">Records</h3>
        <p className="text-xs text-muted-foreground">
          {report.table.rows.length > PREVIEW_ROWS ? `Showing the first ${PREVIEW_ROWS} of ${report.table.rows.length}. Export to get them all.` : `${report.table.rows.length} row${report.table.rows.length === 1 ? "" : "s"}`}
        </p>
        <div className="mt-2 max-h-96 overflow-auto rounded-xl border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="sticky top-0 bg-muted text-xs">
              <tr>{report.table.headers.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {report.table.rows.slice(0, PREVIEW_ROWS).map((row, r) => (
                <tr key={r} data-testid="report-record">
                  {row.map((cell, i) => <td key={i} title={String(cell).length > 40 ? String(cell) : undefined} className="max-w-[16rem] truncate px-3 py-1.5">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
