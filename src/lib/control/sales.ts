import { summarize } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { SEAT_PRICE_CENTS } from "./tiers";
import { effectivePriceCents, extraSeats, type ClientRecord, type Plan } from "./types";

/** The first revenue goal: $10,000 a month of recurring revenue on the books. */
export const DEFAULT_GOAL_CENTS = 1_000_000;

export interface PlanRow { plan: string; active: number; trial: number; mrrCents: number }
export interface MonthRow { key: string; label: string; added: number }

export interface SalesSummary {
  goalCents: number;
  /** Monthly recurring revenue on the books: what active clients are billed per month, extra seats included. */
  mrrCents: number;
  goalPct: number;
  remainingCents: number;
  activeClients: number;
  /** Active clients with a price, which is who the average below is taken over. */
  pricedClients: number;
  avgCents: number;
  /** Active clients still needed at the current average to reach the goal; null when there is no average yet. */
  clientsToGoal: number | null;
  trialClients: number;
  /** What the trials would add per month if every one converted at their plan price. */
  trialPotentialCents: number;
  seatsSold: number;
  extraSeatCents: number;
  addedThisMonth: number;
  byPlan: PlanRow[];
  months: MonthRow[];
  /** From the invoices passed in; null when there are none to read (they live in the browser). */
  collectedThisMonthCents: number | null;
  outstandingCents: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `n` calendar months ending with today's, oldest first, as `YYYY-MM` keys. */
export function lastMonths(today: string, n: number): MonthRow[] {
  let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const out: MonthRow[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift({ key: `${y}-${String(m).padStart(2, "0")}`, label: `${MONTHS[m - 1]} ${String(y).slice(2)}`, added: 0 });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

/** The day a client joined: when they started, otherwise when the record was created. */
const joinedOn = (c: ClientRecord) => (c.startedOn ?? c.createdAt ?? "").slice(0, 10);

/**
 * The numbers behind the sales and revenue counter. Revenue is what the clients are billed per month (their own price
 * or the plan's, plus extra seats), so it moves as soon as a plan, price or seat limit does. Trials are the pipeline:
 * they are counted apart and never in the revenue. Invoice figures are optional because the invoices are saved in the browser.
 */
export function summarizeSales(clients: ClientRecord[], plans: Plan[], invoices: Invoice[] | null, today: string, goalCents = DEFAULT_GOAL_CENTS): SalesSummary {
  const active = clients.filter((c) => c.status === "active");
  const trials = clients.filter((c) => c.status === "trial");
  const priceOf = (c: ClientRecord) => effectivePriceCents(c, plans) ?? 0;
  const mrrCents = active.reduce((t, c) => t + priceOf(c), 0);
  const priced = active.filter((c) => priceOf(c) > 0);
  const avgCents = priced.length ? Math.round(mrrCents / priced.length) : 0;
  const remainingCents = Math.max(0, goalCents - mrrCents);

  const rows = new Map<string, PlanRow>();
  const row = (plan: string) => { const k = plan.toLowerCase(); if (!rows.has(k)) rows.set(k, { plan, active: 0, trial: 0, mrrCents: 0 }); return rows.get(k)!; };
  for (const c of active) { const r = row(c.plan); r.active++; r.mrrCents += priceOf(c); }
  for (const c of trials) row(c.plan).trial++;

  const months = lastMonths(today, 6);
  for (const c of clients) { const m = months.find((x) => x.key === joinedOn(c).slice(0, 7)); if (m) m.added++; }

  const month = today.slice(0, 7);
  const sum = invoices ? summarize(invoices.filter((i) => i.status !== "void"), today) : null;
  return {
    goalCents, mrrCents,
    goalPct: goalCents > 0 ? Math.min(100, Math.round((mrrCents / goalCents) * 100)) : 0,
    remainingCents,
    activeClients: active.length, pricedClients: priced.length, avgCents,
    clientsToGoal: remainingCents === 0 ? 0 : avgCents > 0 ? Math.ceil(remainingCents / avgCents) : null,
    trialClients: trials.length, trialPotentialCents: trials.reduce((t, c) => t + priceOf(c), 0),
    seatsSold: active.reduce((t, c) => t + c.seatsLimit, 0),
    extraSeatCents: active.reduce((t, c) => t + extraSeats(c, plans).count * SEAT_PRICE_CENTS, 0),
    addedThisMonth: clients.filter((c) => joinedOn(c).startsWith(month)).length,
    byPlan: [...rows.values()].sort((a, b) => b.mrrCents - a.mrrCents || a.plan.localeCompare(b.plan)),
    months,
    collectedThisMonthCents: sum ? sum.paidThisMonthCents : null,
    outstandingCents: sum ? sum.outstandingCents : null,
  };
}

/** A goal typed as dollars ("10,000"), as cents; null when it is not a positive amount. */
export function parseGoal(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 10_000_000 ? Math.round(n * 100) : null;
}

/** One day's recurring-revenue figures, as stored in `revenue_snapshots`. */
export interface Snapshot { day: string; mrrCents: number; activeClients: number; trialClients: number; seatsSold: number; extraSeatCents: number; trialPotentialCents: number }

/** Today's snapshot, worked out from the clients and plans (trials are kept apart and never in the revenue). */
export function snapshotFrom(clients: ClientRecord[], plans: Plan[], today: string): Snapshot {
  const s = summarizeSales(clients, plans, null, today);
  return { day: today, mrrCents: s.mrrCents, activeClients: s.activeClients, trialClients: s.trialClients, seatsSold: s.seatsSold, extraSeatCents: s.extraSeatCents, trialPotentialCents: s.trialPotentialCents };
}

export interface Trend {
  first: Snapshot; last: Snapshot; changeCents: number;
  /** Change since the closest snapshot to 30 days before the latest, or null when the history is shorter than that. */
  change30Cents: number | null;
}

/** The movement across a run of snapshots (oldest first); null until there are two days to compare. */
export function trendOf(points: Snapshot[]): Trend | null {
  if (points.length < 2) return null;
  const first = points[0], last = points[points.length - 1];
  const cutoff = new Date(Date.parse(`${last.day}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const base = [...points].reverse().find((p) => p.day <= cutoff) ?? null;
  return { first, last, changeCents: last.mrrCents - first.mrrCents, change30Cents: base ? last.mrrCents - base.mrrCents : null };
}

/** Labelled examples for the preview: about eight weeks of steady growth ending today. */
export function sampleSnapshots(today: string): Snapshot[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: 9 }, (_, i) => {
    const mrr = [0, 5900, 5900, 11800, 17700, 17700, 24600, 30500, 36400][i];
    return { day: new Date(end - (8 - i) * 7 * 86_400_000).toISOString().slice(0, 10), mrrCents: mrr, activeClients: Math.ceil(mrr / 5900), trialClients: 2, seatsSold: Math.ceil(mrr / 5900) * 3, extraSeatCents: 0, trialPotentialCents: 11800 };
  });
}
