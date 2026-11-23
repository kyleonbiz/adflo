import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLIENT_COLUMNS, loadPlans, toClient } from "./data";
import { snapshotFrom, type Snapshot } from "./sales";

type Row = { day: string; mrr_cents: number | string; active_clients: number; trial_clients: number; seats_sold: number; extra_seat_cents: number | string; trial_potential_cents: number | string };

/**
 * Records today's recurring revenue (one row per day; recording again the same day replaces it, so the last write of
 * the day stands). Needs the service role: staff can only read the table. Returns the snapshot, or null when it could
 * not be saved. Never throws: it must not break the page or job that calls it.
 */
export async function recordRevenueSnapshot(admin: SupabaseClient, today: string): Promise<Snapshot | null> {
  try {
    const { data, error } = await admin.from("clients").select(CLIENT_COLUMNS);
    if (error || !data) return null;
    const snap = snapshotFrom((data as Parameters<typeof toClient>[0][]).map(toClient), await loadPlans(admin), today);
    const { error: saveError } = await admin.from("revenue_snapshots").upsert({
      day: snap.day, mrr_cents: snap.mrrCents, active_clients: snap.activeClients, trial_clients: snap.trialClients,
      seats_sold: snap.seatsSold, extra_seat_cents: snap.extraSeatCents, trial_potential_cents: snap.trialPotentialCents, recorded_at: new Date().toISOString(),
    }, { onConflict: "day" });
    return saveError ? null : snap;
  } catch {
    return null;
  }
}

/** The most recent snapshots, oldest first. Empty when the table cannot be read (for example before the migration has run). */
export async function loadSnapshots(supabase: SupabaseClient, days = 180): Promise<Snapshot[]> {
  const { data, error } = await supabase.from("revenue_snapshots")
    .select("day, mrr_cents, active_clients, trial_clients, seats_sold, extra_seat_cents, trial_potential_cents")
    .order("day", { ascending: false }).limit(days);
  if (error) return [];
  return ((data ?? []) as Row[]).reverse().map((r) => ({
    day: r.day, mrrCents: Number(r.mrr_cents), activeClients: r.active_clients, trialClients: r.trial_clients,
    seatsSold: r.seats_sold, extraSeatCents: Number(r.extra_seat_cents), trialPotentialCents: Number(r.trial_potential_cents),
  }));
}
