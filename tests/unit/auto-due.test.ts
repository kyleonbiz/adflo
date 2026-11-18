import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAutoStatus } from "@/lib/control/auto-due";
import type { ClientRecord } from "@/lib/control/types";

const now = new Date("2026-11-20T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

/** A stand-in for the database: every filter returns the same rows for that table. */
function fake(tables: Record<string, unknown[]>): SupabaseClient {
  const chain = (rows: unknown[]): unknown => new Proxy({}, { get: (_t, k) => (k === "then" ? (res: (v: unknown) => void) => res({ data: rows, error: null }) : () => chain(rows)) });
  return { from: (t: string) => chain(tables[t] ?? []) } as unknown as SupabaseClient;
}
const client = (over: Partial<ClientRecord> = {}): ClientRecord => ({
  id: "c1", name: "Acme", status: "active", plan: "standard", seatsLimit: 3, ownerName: "Pat", ownerEmail: "pat@acme.com", notes: "", workspaceId: "w1",
  startedOn: null, createdAt: daysAgo(10), priceOverrideCents: null, priceNote: "", seatsUsed: 0, lastActive: null, checklist: [], ...over,
});

afterEach(() => vi.unstubAllEnvs());

describe("loadAutoStatus", () => {
  it("lists the clients the next run would remind, with what about", async () => {
    const db = fake({ client_checklist: [{ client_id: "c1", done_at: daysAgo(4) }], agreements_sent: [], client_reminders: [] });
    expect(await loadAutoStatus(db, [client()], now)).toEqual({ enabled: true, days: 3, due: { c1: "signup" } });
  });
  it("lists nobody when the client was contacted recently", async () => {
    const db = fake({ client_checklist: [{ client_id: "c1", done_at: daysAgo(1) }], agreements_sent: [], client_reminders: [] });
    expect((await loadAutoStatus(db, [client()], now)).due).toEqual({});
  });
  it("reports off, and lists nobody, when switched off", async () => {
    vi.stubEnv("ONBOARDING_AUTO_REMIND", "off");
    expect(await loadAutoStatus(fake({}), [client()], now)).toEqual({ enabled: false, days: 3, due: {} });
  });
});
