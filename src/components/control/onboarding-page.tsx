"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellRing, CheckCircle2, ClipboardList, Hourglass, Plus } from "lucide-react";
import { SummaryTile } from "@/components/modules/summary-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { STALLED_AFTER_DAYS, summarizeOnboarding, type OnboardingRow } from "@/lib/control/onboarding";
import type { AutoStatus } from "@/lib/control/auto-due";
import { cooldownHoursLeft, nextReminder, reminderAgo } from "@/lib/control/reminders";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const FILTERS = ["progress", "stalled", "complete", "all"] as const;
type Filter = (typeof FILTERS)[number];
const LABEL: Record<Filter, string> = { progress: "In progress", stalled: "Stalled", complete: "Complete", all: "All" };

/** Every client's setup progress in one list, so the ones that are stuck stand out. Each row opens the client's profile. */
export function OnboardingPage({ rows, canAdd, canRemind = false, sample, auto }: { rows: OnboardingRow[]; canAdd: boolean; canRemind?: boolean; sample?: boolean; auto?: AutoStatus }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("progress");
  const [bulkAsk, setBulkAsk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  // Clients who can be reminded right now: something outstanding and not reminded in the last day.
  const remindable = useMemo(() => rows.filter((r) => nextReminder(r.client) && cooldownHoursLeft(r.client.lastReminderAt) === 0), [rows]);
  async function remindAll() {
    setBulkBusy(true); setBulkMsg("");
    let sent = 0, failed = 0;
    for (const r of remindable) {
      const next = nextReminder(r.client);
      if (!next) continue;
      try {
        const res = await fetch(`/api/control/clients/${r.client.id}/remind`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: next.kind }) });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) sent++; else failed++;
      } catch { failed++; }
    }
    setBulkBusy(false); setBulkAsk(false);
    setBulkMsg(`Sent ${sent} reminder${sent === 1 ? "" : "s"}${failed ? `; ${failed} could not be sent` : ""}.`);
    router.refresh();
  }
  const summary = useMemo(() => summarizeOnboarding(rows), [rows]);
  // New clients that still need setting up sit in their own area at the top; the filters below work on everyone else.
  const fresh = useMemo(() => rows.filter((r) => r.isNew), [rows]);
  const rest = useMemo(() => rows.filter((r) => !r.isNew), [rows]);
  const shown = rest.filter((r) => (filter === "all" ? true : filter === "progress" ? !r.complete : filter === "stalled" ? r.stalled : r.complete));
  const count = (f: Filter) => rest.filter((r) => (f === "all" ? true : f === "progress" ? !r.complete : f === "stalled" ? r.stalled : r.complete)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">Where each new client is in getting set up. Open a client to work through their steps.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRemind && !sample && remindable.length > 0 && <Button variant="outline" disabled={bulkBusy} onClick={() => setBulkAsk(true)}><BellRing /> Remind all ({remindable.length})</Button>}
          {canAdd && <Button asChild><Link href="/control/clients"><Plus /> Add a client</Link></Button>}
        </div>
      </div>
      {sample && <p className="py-1 pl-3 text-sm border-l-2 border-amber-500 text-foreground">Preview with sample clients.</p>}
      {auto && <AutoNote auto={auto} />}
      {bulkMsg && <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">{bulkMsg}</p>}
      <ConfirmDialog
        open={bulkAsk} title={`Remind ${remindable.length} client${remindable.length === 1 ? "" : "s"}?`} confirmLabel={bulkBusy ? "Sending…" : "Send"} destructive={false}
        description="Each owner is emailed a reminder about their next outstanding step. Fresh links replace any earlier ones. Clients reminded in the last day are skipped."
        onCancel={() => !bulkBusy && setBulkAsk(false)} onConfirm={() => void remindAll()}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile icon={Hourglass} label="Being set up" value={summary.inProgress} tone="text-sky-600" />
        <SummaryTile icon={AlertTriangle} label={`Stalled (over ${STALLED_AFTER_DAYS} days)`} value={summary.stalled} tone={summary.stalled ? "text-red-600" : "text-emerald-600"} />
        <SummaryTile icon={ClipboardList} label="Not started" value={summary.notStarted} tone="text-amber-600" />
        <SummaryTile icon={CheckCircle2} label="Fully set up" value={summary.complete} tone="text-emerald-600" />
      </div>

      {fresh.length > 0 && (
        <section aria-label="New clients to onboard" className="space-y-3 rounded-xl border bg-card p-4 shadow-panel">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">New</Badge>
            <h2 className="font-semibold">New clients to onboard ({fresh.length})</h2>
          </div>
          <p className="text-sm text-muted-foreground">Waiting for the owner&apos;s first sign-in. Each one leaves this area once the owner has signed in, however many steps are left.</p>
          <ul className="divide-y rounded-xl border bg-card">
            {fresh.map((r) => <OnboardingItem key={r.client.id} r={r} canRemind={canRemind && !sample} auto={auto} />)}
          </ul>
        </section>
      )}

      {(rest.length > 0 || fresh.length === 0) && (
        <>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={cn("h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === f ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
            {LABEL[f]} {count(f)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-panel">
          <p className="font-medium">{rows.length === 0 ? "No clients to set up yet" : filter === "stalled" ? "Nothing is stalled" : "No clients here"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length === 0 ? "Add a client and they will appear here with their onboarding steps." : "Try another filter."}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-panel">
          {shown.map((r) => <OnboardingItem key={r.client.id} r={r} canRemind={canRemind && !sample} auto={auto} />)}
        </ul>
      )}
        </>
      )}
    </div>
  );
}

/** One client's row: progress and the next step, opening their profile at the onboarding guide. */
function OnboardingItem({ r, canRemind, auto }: { r: OnboardingRow; canRemind: boolean; auto?: AutoStatus }) {
  return (
            <li className="flex flex-wrap items-center gap-x-3 sm:flex-nowrap">
              <Link href={`/control/clients/${r.client.id}#onboarding`} className="grid min-w-0 flex-1 gap-x-4 gap-y-2 px-4 py-3.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium"><span className="truncate">{r.client.name}</span>{r.isNew && <Badge variant="warning">New</Badge>}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={r.client.status} />
                    <span>{r.daysSinceStart === 0 ? "Started today" : `Started ${r.daysSinceStart} ${r.daysSinceStart === 1 ? "day" : "days"} ago`}</span>
                    {r.stalled && <Badge variant="danger">Stalled</Badge>}
                  </p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"><span>Progress</span><span className="tabular-nums">{r.done} of {r.total}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${r.client.name} onboarding`} aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.done}>
                    <div className={cn("h-full rounded-full", r.complete ? "bg-emerald-500" : r.stalled ? "bg-red-500" : "bg-primary")} style={{ width: `${(r.done / r.total) * 100}%` }} />
                  </div>
                </div>
                <p className="min-w-0 text-sm">{r.complete ? <span className="text-emerald-700">All steps done</span> : <><span className="text-muted-foreground">Next: </span>{r.next}</>}</p>
              </Link>
              <ReminderButton row={r} canRemind={canRemind} autoDue={auto?.due[r.client.id]} />
            </li>
  );
}

/** "Remind" for one client: emails the owner about their next outstanding step, after a confirm. Shows when they were last reminded. */
function ReminderButton({ row, canRemind, autoDue }: { row: OnboardingRow; canRemind: boolean; autoDue?: "signup" | "agreement" }) {
  const router = useRouter();
  const c = row.client;
  const next = nextReminder(c);
  const ago = reminderAgo(c.lastReminderAt);
  const wait = cooldownHoursLeft(c.lastReminderAt);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!next && !ago && !msg && !autoDue) return null;
  async function send() {
    if (!next) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/control/clients/${c.id}/remind`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: next.kind }) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { setMsg({ ok: true, text: `Reminder sent to ${json.emailedTo}.` }); router.refresh(); }
      else setMsg({ ok: false, text: json?.error?.message ?? "Could not send the reminder. Try again." });
    } catch { setMsg({ ok: false, text: "Could not reach the server. Try again." }); } finally { setBusy(false); setConfirm(false); }
  }
  return (
    <div className="w-full shrink-0 space-y-1 px-4 pb-3 text-xs sm:w-56 sm:px-0 sm:pb-0 sm:pr-4 sm:text-right">
      {canRemind && next && !confirm && (
        <Button type="button" variant="outline" size="sm" disabled={wait > 0} onClick={() => { setConfirm(true); setMsg(null); }} aria-label={`${next.label}: ${c.name}`}><BellRing /> {next.label}</Button>
      )}
      {canRemind && next && confirm && (
        <span className="flex flex-wrap items-center gap-2 sm:justify-end">Email {c.ownerEmail} {next.what}?
          <Button type="button" size="sm" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send"}</Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button></span>
      )}
      {autoDue && !msg && <p><Badge variant="warning">Auto reminder due</Badge></p>}
      {ago && !msg && <p className="text-muted-foreground">Last reminded {ago}{wait > 0 && next ? ` · again in about ${wait} h` : ""}</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-emerald-700" : "text-destructive"}>{msg.text}</p>}
    </div>
  );
}

/** Says whether the daily automatic reminders are on and who the next run would remind, so nobody has to run the job to find out. */
function AutoNote({ auto }: { auto: AutoStatus }) {
  const n = Object.keys(auto.due).length;
  if (!auto.enabled) return <p role="note" className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Automatic reminders are off. Use the Remind buttons to nudge a client by hand.</p>;
  return (
    <p role="note" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
      Automatic reminders are on: a client who has not signed up or accepted their agreement for {auto.days} {auto.days === 1 ? "day" : "days"} is emailed once a day at about 10 am Eastern, up to 3 times.{" "}
      <span className="font-medium">{n === 0 ? "Nobody is due at the next run." : `${n} ${n === 1 ? "client is" : "clients are"} due at the next run (marked below).`}</span>
    </p>
  );
}
