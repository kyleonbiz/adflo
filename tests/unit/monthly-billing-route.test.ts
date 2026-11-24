import { beforeEach, describe, expect, it, vi } from "vitest";

interface Db {
  clients: Record<string, unknown>[]; plans: Record<string, unknown>[]; invoices: { id: string; client_id: string | null; data: Record<string, unknown> }[];
  staff: { email: string; role: string; active: boolean }[]; jobRun: { ran_at: string; ok: boolean } | null; failInsert?: boolean;
}
const h = vi.hoisted(() => ({ db: null as unknown, sent: [] as Record<string, unknown>[], runs: [] as [string, boolean, string][], mailReady: true }));
const DB = () => h.db as Db;

function fakeAdmin() {
  return {
    from(table: string) {
      const q: { f: Record<string, unknown>; ins?: Record<string, unknown>[] } = { f: {} };
      const exec = () => {
        const db = DB();
        if (q.ins) {
          if (db.failInsert) return { error: { message: "x" } };
          for (const r of q.ins) if (!db.invoices.some((i) => i.id === r.id)) db.invoices.push(r as never);
          return { error: null };
        }
        if (table === "clients") return { data: db.clients.filter((c) => c.status === q.f.status), error: null };
        if (table === "plans") return { data: db.plans, error: null };
        if (table === "control_invoices") return { data: db.invoices, error: null };
        if (table === "staff_members") return { data: db.staff.filter((s) => s.active === q.f.active), error: null };
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain, limit: () => chain, in: () => chain,
        eq: (k: string, v: unknown) => { q.f[k] = v; return chain; },
        upsert: (rows: Record<string, unknown>[]) => { q.ins = rows; return chain; },
        maybeSingle: async () => ({ data: table === "job_runs" ? DB().jobRun : null }),
        then: (resolve: (v: unknown) => unknown) => resolve(exec()),
      };
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => fakeAdmin() }));
vi.mock("@/lib/control/job-runs", () => ({ recordJobRun: async (j: string, ok: boolean, d: string) => { h.runs.push([j, ok, d]); } }));
vi.mock("@/lib/mail/onboarding", () => ({
  onboardingMailReady: () => h.mailReady,
  sendOnboardingEmail: async (m: Record<string, unknown>) => { h.sent.push(m); },
}));

import { GET } from "@/app/api/maintenance/monthly-billing/route";

const SECRET = "s".repeat(24);
const call = (q = "", headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) => GET(new Request(`http://localhost/api/maintenance/monthly-billing${q}`, { headers }));
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const client = (o: Record<string, unknown> = {}) => ({ id: "7a000000-0000-4000-8000-0000000000c1", name: "Acme Roofing", status: "active", plan: "standard", owner_email: "pat@acme.test", seats_limit: 3, price_override_cents: null, stripe_subscription_id: null, ...o });
const FIRST = new Date("2026-12-01T10:17:00Z");

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(FIRST);
  h.sent = []; h.runs = []; h.mailReady = true;
  h.db = {
    clients: [client(), client({ id: "7a000000-0000-4000-8000-0000000000c2", name: "Stripe Co", stripe_subscription_id: "sub_1" }), client({ id: "7a000000-0000-4000-8000-0000000000c3", name: "Free Co", plan: "nothing" })],
    plans: [{ id: "p1", name: "standard", price_cents: 9900, seats_included: 3, active: true }],
    invoices: [], staff: [{ email: "owner@adflo.test", role: "owner", active: true }, { email: "gone@adflo.test", role: "billing", active: false }], jobRun: null,
  } satisfies Db;
});

describe("monthly-billing job", () => {
  it("refuses without the secret", async () => {
    expect((await call("", {})).status).toBe(401);
  });

  it("makes a draft for each client AdFlo invoices itself, leaves out Stripe and unpriced clients, and tells the owner", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, drafts: 1, emailed: 1 });
    const [row] = DB().invoices;
    expect(row).toMatchObject({ id: "inv-7a000000-0000-4000-8000-0000000000c1-2026-12", client_id: "7a000000-0000-4000-8000-0000000000c1" });
    expect(row.data).toMatchObject({ status: "draft", amountCents: 9900, client: "Acme Roofing", issuedOn: "2026-12-01" });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "owner@adflo.test" });
    expect(String(h.sent[0].text)).toContain("Nothing has been sent to any client");
    expect(h.runs.at(-1)!.slice(0, 2)).toEqual(["monthly-billing", true]);
  });

  it("never makes a second one for a client, even when run again with force", async () => {
    await call();
    expect(await json(await call("?force=1"))).toMatchObject({ drafts: 0 });
    expect(DB().invoices).toHaveLength(1);
  });

  it("does nothing after the first days of the month, or once it has done the month", async () => {
    vi.setSystemTime(new Date("2026-12-15T10:17:00Z"));
    expect(await json(await call())).toMatchObject({ skipped: "not the start of the month" });
    expect(DB().invoices).toEqual([]);
    vi.setSystemTime(new Date("2026-12-02T10:17:00Z"));
    DB().jobRun = { ran_at: "2026-12-01T10:17:00Z", ok: true };
    expect(await json(await call())).toMatchObject({ skipped: "already done this month" });
    DB().jobRun = { ran_at: "2026-12-01T10:17:00Z", ok: false }; // a failed run is tried again
    expect(await json(await call())).toMatchObject({ drafts: 1 });
  });

  it("skips a client that already has an invoice for the month", async () => {
    await call();
    DB().jobRun = null;
    expect(await json(await call())).toMatchObject({ drafts: 0 });
  });

  it("a dry run counts and changes nothing; a failed save is reported and nobody is emailed", async () => {
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, drafts: 1 });
    expect(DB().invoices).toEqual([]);
    DB().failInsert = true;
    const res = await call();
    expect(res.status).toBe(500);
    expect(h.sent).toEqual([]);
    expect(h.runs.at(-1)!.slice(0, 2)).toEqual(["monthly-billing", false]);
  });

  it("still makes the drafts when email is not set up", async () => {
    h.mailReady = false;
    expect(await json(await call())).toMatchObject({ drafts: 1, emailed: 0 });
    expect(DB().invoices).toHaveLength(1);
  });
});
