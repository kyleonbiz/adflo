"use client";

import Link from "next/link";
import { useState } from "react";
import { History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIT_AREAS, formatWhen, type AuditArea } from "@/lib/audit/logic";
import { useAuditEntries } from "@/lib/audit/storage";

/** Who did what, and when, newest first. Kept in this browser until a database is connected. */
export function ActivityPage({ preview }: { preview?: string }) {
  const entries = useAuditEntries();
  const [area, setArea] = useState<"all" | AuditArea>("all");
  const shown = area === "all" ? entries : entries.filter((e) => e.area === area);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground">Who did what, and when.</p>
        </div>
        <Select value={area} onValueChange={(v) => setArea(v as "all" | AuditArea)}>
          <SelectTrigger aria-label="Filter activity by area" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {AUDIT_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {preview && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>}

      {shown.length === 0 ? (
        <section className="rounded-2xl border bg-card p-8 text-center shadow-panel" data-testid="activity-empty">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><History className="size-5" aria-hidden /></span>
          <h2 className="mt-3 text-lg font-semibold">{entries.length === 0 ? "Nothing has happened yet" : "Nothing here for that area"}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {entries.length === 0 ? "When someone adds, changes, sends or deletes something, it shows here with their name and the time." : "Pick another area to see more."}
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
    </div>
  );
}
