"use client";

import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv } from "@/lib/csv";
import { textToPdf } from "@/lib/forms/pdf";
import { printText } from "@/lib/forms/print";
import type { ModuleReport } from "@/lib/reporting/logic";
import { overviewText, reportText } from "@/lib/reporting/schedule";

export function downloadBlob(data: string | Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Ready-made documents built from your records: print them, save them as PDF, or take the rows as a spreadsheet. */
export function Materials({ reports, today }: { reports: ModuleReport[]; today: string }) {
  const summary = overviewText(reports, today);
  return (
    <div className="space-y-5" data-testid="materials">
      <section aria-label="Business summary" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-panel">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-5 text-primary" aria-hidden />
          <div>
            <h2 className="text-base font-semibold">Business summary</h2>
            <p className="text-sm text-muted-foreground">Every service on one document, for a partner, a bank or your own files.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadBlob(textToPdf(summary), `business-summary-${today}.pdf`, "application/pdf")}><Download /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => printText("Business summary", summary)}><Printer /> Print</Button>
        </div>
      </section>

      <section aria-label="By service" className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">By service</h2>
        <ul className="divide-y rounded-2xl border bg-card shadow-panel">
          {reports.map((r) => (
            <li key={r.id} data-testid="material-row" className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.count === 0 ? "No records yet" : `${r.count} ${r.noun}`}</p>
              </div>
              <Button size="sm" variant="outline" aria-label={`${r.name} PDF`} onClick={() => downloadBlob(textToPdf(reportText(r, today)), `${slug(r.name)}-report-${today}.pdf`, "application/pdf")}><Download /> PDF</Button>
              <Button size="sm" variant="outline" aria-label={`${r.name} spreadsheet`} disabled={r.table.rows.length === 0} onClick={() => downloadBlob(toCsv([r.table.headers, ...r.table.rows]), `${slug(r.name)}-${today}.csv`, "text/csv")}><FileSpreadsheet /> CSV</Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
