"use client";

import { useState } from "react";
import { CalendarClock, Download, Printer, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDayLong } from "@/lib/dates";
import { textToPdf } from "@/lib/forms/pdf";
import { printText } from "@/lib/forms/print";
import type { ModuleReport } from "@/lib/reporting/logic";
import {
  OVERVIEW_ID, SCHEDULE_EVERY, addSchedule, dueSchedules, markDelivered, overviewText, parseRecipients, removeSchedule, reportText,
  type ScheduleEvery, type ScheduledReport,
} from "@/lib/reporting/schedule";
import { saveSchedules, useSchedules } from "@/lib/reporting/schedule-storage";
import { downloadBlob } from "./materials";

const nameOf = (reports: ModuleReport[], id: string) => (id === OVERVIEW_ID ? "Business summary" : reports.find((r) => r.id === id)?.name ?? id);
const textOf = (reports: ModuleReport[], id: string, today: string) => {
  const r = reports.find((x) => x.id === id);
  return id === OVERVIEW_ID || !r ? overviewText(reports, today) : reportText(r, today);
};

/**
 * Reports that come round on their own. Nothing here is emailed yet: a report that falls due waits on this
 * page, ready to print or save, and moves to its next date once you have taken it.
 */
export function ScheduledReports({ reports, today }: { reports: ModuleReport[]; today: string }) {
  const list = useSchedules();
  const [reportId, setReportId] = useState(OVERVIEW_ID);
  const [every, setEvery] = useState<ScheduleEvery>("monthly");
  const [startOn, setStartOn] = useState(today);
  const [recipients, setRecipients] = useState("");
  const [error, setError] = useState("");
  const due = dueSchedules(list, today);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const { invalid } = parseRecipients(recipients);
    if (invalid.length > 0) { setError(`These are not email addresses: ${invalid.join(", ")}`); return; }
    setError("");
    saveSchedules(addSchedule(list, { reportId, every, nextOn: startOn || today, recipients: parseRecipients(recipients).valid.join(", ") }, `sr-${Math.random().toString(36).slice(2, 10)}`));
    setRecipients("");
  };

  const take = (s: ScheduledReport, how: "pdf" | "print") => {
    const name = nameOf(reports, s.reportId);
    const text = textOf(reports, s.reportId, today);
    if (how === "print") printText(name, text);
    else downloadBlob(textToPdf(text), `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${today}.pdf`, "application/pdf");
    if (s.nextOn <= today) saveSchedules(markDelivered(list, s.id, today));
  };

  return (
    <div className="space-y-5" data-testid="scheduled-reports">
      {due.length > 0 && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" data-testid="due-banner">
          {due.length === 1 ? "1 report is due." : `${due.length} reports are due.`} Print or download them below.
        </p>
      )}

      <form onSubmit={create} className="grid gap-3 rounded-2xl border bg-card p-4 shadow-panel sm:grid-cols-2 lg:grid-cols-4" aria-label="Schedule a report">
        <div className="space-y-1.5">
          <Label htmlFor="sched-report">Report</Label>
          <Select value={reportId} onValueChange={setReportId}>
            <SelectTrigger id="sched-report" aria-label="Report"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={OVERVIEW_ID}>Business summary</SelectItem>
              {reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sched-every">How often</Label>
          <Select value={every} onValueChange={(v) => setEvery(v as ScheduleEvery)}>
            <SelectTrigger id="sched-every" aria-label="How often"><SelectValue /></SelectTrigger>
            <SelectContent>{SCHEDULE_EVERY.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sched-start">First one</Label>
          <Input id="sched-start" type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sched-to">Send to (optional)</Label>
          <Input id="sched-to" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="name@company.com, ..." aria-invalid={!!error} />
        </div>
        {error && <p role="alert" className="text-xs text-destructive sm:col-span-2 lg:col-span-4">{error}</p>}
        <div className="sm:col-span-2 lg:col-span-4"><Button type="submit"><CalendarClock /> Schedule report</Button></div>
      </form>

      <section aria-label="Scheduled" className="space-y-2">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">No reports scheduled. Pick one above and it will come round on its own.</div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card shadow-panel">
            {[...list].sort((a, b) => a.nextOn.localeCompare(b.nextOn)).map((s) => {
              const isDue = s.nextOn <= today;
              return (
                <li key={s.id} data-testid="scheduled-report" className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">{nameOf(reports, s.reportId)} {isDue && <Badge variant="warning">Due</Badge>}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {SCHEDULE_EVERY.find((e) => e.value === s.every)?.label} · next {formatDayLong(s.nextOn)}{s.recipients && ` · for ${s.recipients}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" aria-label={`Download PDF: ${nameOf(reports, s.reportId)}`} onClick={() => take(s, "pdf")}><Download /> PDF</Button>
                  <Button size="sm" variant="outline" aria-label={`Print: ${nameOf(reports, s.reportId)}`} onClick={() => take(s, "print")}><Printer /> Print</Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove schedule: ${nameOf(reports, s.reportId)}`} onClick={() => saveSchedules(removeSchedule(list, s.id))}><Trash2 /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
