"use client";

import { useState, useSyncExternalStore } from "react";
import { Armchair, Banknote, CircleDollarSign, Flag, HandCoins, Sparkles, UserPlus, Users } from "lucide-react";
import { SummaryTile } from "@/components/modules/summary-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToday } from "@/components/modules/use-today";
import { SAMPLE_INVOICES } from "@/lib/control/billing";
import { useSavedInvoices } from "@/lib/control/billing-storage";
import { DEFAULT_GOAL_CENTS, parseGoal, summarizeSales } from "@/lib/control/sales";
import { formatMoney, type ClientRecord, type Plan } from "@/lib/control/types";

const KEY = "adflo.control.salesGoal";
const EVENT = "adflo-control-sales-goal";
const read = () => { try { const v = Number(window.localStorage.getItem(KEY)); return Number.isInteger(v) && v > 0 ? v : DEFAULT_GOAL_CENTS; } catch { return DEFAULT_GOAL_CENTS; } };
const subscribe = (cb: () => void) => { window.addEventListener(EVENT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); }; };
const saveGoal = (cents: number) => { try { window.localStorage.setItem(KEY, String(cents)); } catch { /* blocked: the goal resets on reload */ } window.dispatchEvent(new Event(EVENT)); };

/**
 * The sales and revenue counter: recurring revenue against the goal, who is paying, the trials in the pipeline and how
 * many clients were added each month. Revenue comes from the clients' plans, prices and seats; the money collected
 * comes from the billing invoices, which are saved in this browser.
 */
export function SalesPage({ clients, plans, today, sample }: { clients: ClientRecord[]; plans: Plan[]; today: string; sample: boolean }) {
  const goal = useSyncExternalStore(subscribe, read, () => DEFAULT_GOAL_CENTS);
  const saved = useSavedInvoices();
  const day = useToday() ?? today;
  const invoices = saved ?? (sample ? SAMPLE_INVOICES(today) : null);
  const s = summarizeSales(clients, plans, invoices, day, goal);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const peak = Math.max(1, ...s.months.map((m) => m.added));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseGoal(draft);
    if (cents === null) { setError("Enter a goal in dollars, such as 10,000."); return; }
    setError(""); saveGoal(cents); setDraft("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales &amp; revenue</h1>
        <p className="text-sm text-muted-foreground">Recurring revenue on the books against your goal, who is paying, and what is in the pipeline.{sample ? " Preview with sample clients." : ""}</p>
      </div>

      <section aria-label="Revenue goal" className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Monthly recurring revenue</p>
            <p className="text-4xl font-semibold tabular-nums">{formatMoney(s.mrrCents)} <span className="text-base font-normal text-muted-foreground">of {formatMoney(s.goalCents)} a month</span></p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{s.goalPct}%</p>
        </div>
        <div role="progressbar" aria-label="Progress to the monthly revenue goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.goalPct} className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand-blue" style={{ width: `${s.goalPct}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          {s.remainingCents === 0
            ? "Goal reached. Raise it to keep a target in front of you."
            : s.clientsToGoal === null
              ? `${formatMoney(s.remainingCents)} a month to go. Once a client is paying, this shows how many more you need.`
              : `${formatMoney(s.remainingCents)} a month to go: about ${s.clientsToGoal} more paying client${s.clientsToGoal === 1 ? "" : "s"} at today's average of ${formatMoney(s.avgCents)}.`}
        </p>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="sales-goal">Monthly goal (dollars)</Label>
            <Input id="sales-goal" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={String(goal / 100)} className="w-40" aria-invalid={error ? true : undefined} aria-describedby={error ? "sales-goal-err" : undefined} />
          </div>
          <Button type="submit" variant="outline">Set goal</Button>
          {error && <p id="sales-goal-err" role="alert" className="w-full text-sm text-red-700">{error}</p>}
          <p className="w-full text-xs text-muted-foreground">The goal is saved in this browser.</p>
        </form>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryTile icon={Banknote} label="Recurring revenue / month" value={formatMoney(s.mrrCents)} tone="text-emerald-600" />
        <SummaryTile icon={Users} label="Paying clients" value={s.activeClients} tone="text-primary" href="/control/clients" />
        <SummaryTile icon={CircleDollarSign} label="Average per client" value={s.pricedClients ? formatMoney(s.avgCents) : "—"} tone="text-primary" />
        <SummaryTile icon={Flag} label="Clients to reach goal" value={s.clientsToGoal ?? "—"} tone="text-amber-600" />
        <SummaryTile icon={Sparkles} label="Trials in the pipeline" value={s.trialClients} tone="text-sky-600" href="/control/clients" />
        <SummaryTile icon={HandCoins} label="If every trial converts" value={`+${formatMoney(s.trialPotentialCents)}`} tone="text-sky-600" />
        <SummaryTile icon={Armchair} label={`Seats sold · ${formatMoney(s.extraSeatCents)} from extra seats`} value={s.seatsSold} tone="text-primary" />
        <SummaryTile icon={UserPlus} label="Clients added this month" value={s.addedThisMonth} tone="text-emerald-600" />
        <SummaryTile icon={Banknote} label="Collected this month" value={s.collectedThisMonthCents === null ? "—" : formatMoney(s.collectedThisMonthCents)} tone="text-emerald-600" href="/control/billing" />
        <SummaryTile icon={CircleDollarSign} label="Invoiced, not yet paid" value={s.outstandingCents === null ? "—" : formatMoney(s.outstandingCents)} tone={s.outstandingCents ? "text-amber-600" : "text-emerald-600"} href="/control/billing" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Revenue by plan" className="rounded-2xl border bg-card p-5 shadow-panel">
          <h2 className="text-lg font-semibold">By plan</h2>
          {s.byPlan.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No clients yet.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">{["Plan", "Paying", "Trials", "Per month"].map((h, i) => <th key={h} scope="col" className={`py-2 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {s.byPlan.map((r) => (
                    <tr key={r.plan}><th scope="row" className="py-2 text-left font-medium capitalize">{r.plan}</th><td className="py-2 text-right tabular-nums">{r.active}</td><td className="py-2 text-right tabular-nums">{r.trial}</td><td className="py-2 text-right tabular-nums">{formatMoney(r.mrrCents)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Enterprise is quoted per client, so it adds nothing here until a client has their own price.</p>
        </section>

        <section aria-label="Clients added by month" className="rounded-2xl border bg-card p-5 shadow-panel">
          <h2 className="text-lg font-semibold">Clients added</h2>
          <ul className="mt-3 space-y-2">
            {s.months.map((m) => (
              <li key={m.key} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-muted-foreground">{m.label}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-brand-blue" style={{ width: `${(m.added / peak) * 100}%` }} /></span>
                <span className="w-6 shrink-0 text-right font-medium tabular-nums">{m.added}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">By the date each client started, or was created when no start date is set.</p>
        </section>
      </div>
      {!sample && saved === null && <p className="text-xs text-muted-foreground">Collected and invoiced figures read the billing invoices saved in this browser; they show a dash until some exist here.</p>}
    </div>
  );
}
