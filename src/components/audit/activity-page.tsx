"use client";

import { PreviewNote } from "@/components/ui/preview-note";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toCsv } from "@/lib/csv";
import { downloadText } from "@/components/import/csv-source";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIT_AREAS, formatWhen, type AuditArea } from "@/lib/audit/logic";
import { useAuditEntries } from "@/lib/audit/storage";

const PAGE = 100;

/** Who did what, and when, newest first. Kept in this browser until a database is connected. */
export function ActivityPage({ preview }: { preview?: string }) {
  const entries = useAuditEntries();
  const [area, setArea] = useState<"all" | AuditArea>("all");
  const [person, setPerson] = useState("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const people = useMemo(() => [...new Set(entries.map((e) => e.by))].sort((a, b) => a.localeCompare(b)), [entries]);
  const q = query.trim().toLowerCase();
  const matching = entries.filter((e) => {
    const day = e.at.slice(0, 10);
    return (area === "all" || e.area === area) && (person === "all" || e.by === person) && (!from || day >= from) && (!to || day <= to) &&
      (!q || `${e.by} ${e.verb} ${e.what}`.toLowerCase().includes(q));
  });
  const shown = matching.slice(0, limit);
  const filtered = matching.length !== entries.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground">Who did what, and when.</p>
        </div>
        <Button
          variant="outline" disabled={matching.length === 0}
          onClick={() => downloadText(toCsv([["When", "Who", "Action", "What", "Area"], ...matching.map((e) => [e.at, e.by, e.verb, e.what, e.area])]), "activity.csv", "text/csv")}
        >
          <Download /> Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search activity" aria-label="Search activity" className="pl-9" />
        </div>
        <Select value={area} onValueChange={(v) => { setArea(v as "all" | AuditArea); setLimit(PAGE); }}>
          <SelectTrigger aria-label="Filter activity by area" className="lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {AUDIT_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={person} onValueChange={(v) => { setPerson(v); setLimit(PAGE); }}>
          <SelectTrigger aria-label="Filter activity by person" className="lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {people.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setLimit(PAGE); }} aria-label="From date" className="lg:w-40" />
        <Input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setLimit(PAGE); }} aria-label="To date" className="lg:w-40" />
      </div>

      {preview && <PreviewNote>{preview}</PreviewNote>}

      {shown.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center shadow-panel" data-testid="activity-empty">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><History className="size-5" aria-hidden /></span>
          <h2 className="mt-3 text-lg font-semibold">{entries.length === 0 ? "Nothing has happened yet" : "Nothing matches those filters"}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {entries.length === 0 ? "When someone adds, changes, sends or deletes something, it shows here with their name and the time." : "Clear a filter to see more."}
          </p>
        </section>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-panel" aria-label="Activity">
          {shown.map((e) => (
            <li key={e.id} data-testid="activity-item" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
              <p className="min-w-0 text-sm">
                <span className="font-semibold">{e.by}</span> {e.verb}{" "}
                <Link href={e.href} className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{e.what}</Link>
              </p>
              <p className="shrink-0 text-xs text-muted-foreground">{e.area} · <time dateTime={e.at}>{formatWhen(e.at)}</time></p>
            </li>
          ))}
        </ul>
      )}
      {matching.length > shown.length && (
        <div className="flex justify-center"><Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>Show more ({matching.length - shown.length} left)</Button></div>
      )}
      {filtered && matching.length > 0 && <p className="text-center text-xs text-muted-foreground">Showing {matching.length} of {entries.length} entries.</p>}
    </div>
  );
}
