"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppError, ClientRecord, HealthCheck } from "@/lib/control/types";
import { cn } from "@/lib/utils";

const ICON = { ok: CircleCheck, warn: CircleAlert, down: CircleX } as const;
const TONE = { ok: "text-emerald-600", warn: "text-amber-600", down: "text-red-600" } as const;
const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export interface ClientProblem { client: Pick<ClientRecord, "id" | "name">; failedDocs: number; errors: number }

/** Health of the platform, the error log, and which clients are having trouble. */
export function MonitoringPage({ checks, errors, problems, canEdit, sample }: { checks: HealthCheck[]; errors: AppError[]; problems: ClientProblem[]; canEdit: boolean; sample?: boolean }) {
  const router = useRouter();
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const open = errors.filter((e) => !e.resolvedAt);
  const rows = showResolved ? errors : open;

  async function resolve(id: number, resolved: boolean) {
    setBusy(id); setMessage("");
    try {
      const res = await fetch(`/api/control/errors/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ resolved }) });
      if (res.ok) router.refresh(); else setMessage((await res.json().catch(() => null))?.error?.message ?? "Could not save. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1><p className="text-sm text-muted-foreground">Is AdFlo healthy, what has gone wrong, and which clients are affected.</p></div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample data.</p>}

      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Health">
        <h2 className="font-semibold">Health</h2>
        <ul className="mt-2 divide-y">
          {checks.map((c) => { const Icon = ICON[c.level]; return (
            <li key={c.name} className="flex items-start gap-3 py-2.5 text-sm"><Icon className={cn("mt-0.5 size-4 shrink-0", TONE[c.level])} aria-hidden /><span className="min-w-0"><span className="font-medium">{c.name}</span><span className="sr-only"> {c.level === "ok" ? "is fine" : c.level === "warn" ? "needs attention" : "is down"}.</span> <span className="text-muted-foreground">{c.detail}</span></span></li>
          ); })}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Clients with problems">
        <h2 className="font-semibold">Clients with problems</h2>
        {problems.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No client has failed documents or recent errors.</p> : (
          <ul className="mt-2 divide-y">{problems.map((p) => (
            <li key={p.client.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              {sample ? <span className="font-medium">{p.client.name}</span> : <Link href={`/control/clients/${p.client.id}`} className="font-medium hover:underline">{p.client.name}</Link>}
              <span className="flex flex-wrap gap-1.5">{p.failedDocs > 0 && <Badge variant="warning">{p.failedDocs} document{p.failedDocs === 1 ? "" : "s"} could not be indexed</Badge>}{p.errors > 0 && <Badge variant="danger">{p.errors} error{p.errors === 1 ? "" : "s"} this week</Badge>}</span>
            </li>))}</ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Errors">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">Errors <span className="text-sm font-normal text-muted-foreground">{open.length} open</span></h2><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="size-4" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved</label></div>
        <p className="mt-1 text-xs text-muted-foreground">Only the kind of error and where it happened are kept. Messages and client data are never stored.</p>
        {rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{errors.length === 0 ? "No errors recorded." : "No open errors."}</p> : (
          <ul className="mt-2 divide-y">{rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0"><span className="font-medium">{e.kind}</span> <span className="text-muted-foreground">in {e.source}{e.status ? ` (${e.status})` : ""}{e.clientName ? ` · ${e.clientName}` : ""} · {stamp(e.at)}</span></span>
              {e.resolvedAt ? <span className="flex items-center gap-2"><Badge variant="muted">Resolved</Badge>{canEdit && <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => resolve(e.id, false)}>Reopen</Button>}</span>
                : canEdit && <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => resolve(e.id, true)}>Mark resolved</Button>}
            </li>))}</ul>
        )}
        {message && <p role="alert" className="mt-2 text-sm text-destructive">{message}</p>}
      </section>
    </div>
  );
}
