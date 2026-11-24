import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { id: string; name: string; status: string; owner_name: string; owner_email: string; workspace_id: string | null; stripe_subscription_id: string | null; billing_status: string | null; trial_ends_at: string | null; trial_ending_sent_at: string | null; trial_ended_sent_at: string | null; self_serve: boolean }
const h = vi.hoisted(() => ({ rows: [] as unknown[], sent: [] as Record<string, unknown>[], failSend: false }));
const rows = () => h.rows as Row[];

function fakeAdmin() {
  return {
    from() {
      const q: { op: string; payload?: Record<string, unknown>; f: Record<string, unknown>; nulls: string[] } = { op: "select", f: {}, nulls: [] };
      const exec = () => {
        const match = rows().filter((r) => Object.entries(q.f).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v) && q.nulls.every((k) => (r as unknown as Record<string, unknown>)[k] === null));
        if (q.op === "update") { for (const r of match) Object.assign(r, q.payload); return { data: match.map((r) => ({ id: r.id })), error: null }; }
        return { data: match.filter((r) => r.status === "trial" && r.trial_ends_at), error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (p: Record<string, unknown>) => { q.op = "update"; q.payload = p; return chain; },
        eq: (k: string, v: unknown) => { q.f[k] = v; return chain; },
        is: (k: string) => { q.nulls.push(k); return chain; },
        not: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(exec()),
      };
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => fakeAdmin() }));
vi.mock("@/lib/control/job-runs", () => ({ recordJobRun: async () => undefined }));
vi.mock("@/lib/mail/onboarding", () => ({
  onboardingMailReady: () => true,
  sendOnboardingEmail: async (m: Record<string, unknown>) => { if (h.failSend) throw new Error("down"); h.sent.push(m); },
}));

import { GET } from "@/app/api/maintenance/trial-nudges/route";

const SECRET = "s".repeat(24);
const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();
const call = (q = "", headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) => GET(new Request(`http://localhost/api/maintenance/trial-nudges${q}`, { headers }));
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const trial = (o: Partial<Row> = {}): Row => ({ id: "c1", name: "Acme Roofing", status: "trial", owner_name: "Pat Lee", owner_email: "pat@acme.test", workspace_id: null, stripe_subscription_id: null, billing_status: null, trial_ends_at: hours(20), trial_ending_sent_at: null, trial_ended_sent_at: null, self_serve: true, ...o });

beforeEach(() => { vi.stubEnv("CRON_SECRET", SECRET); h.rows = [trial()]; h.sent = []; h.failSend = false; });

describe("trial-nudges job", () => {
  it("refuses without the secret", async () => {
    expect((await call("", {})).status).toBe(401);
  });

  it("emails the owner once when the trial is about to end, and a rerun sends nothing", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, ending: 1, ended: 0 });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "pat@acme.test", subject: "Your AdFlo trial ends soon" });
    expect(String(h.sent[0].text)).toContain("/trial/continue");
    expect(rows()[0].trial_ending_sent_at).not.toBeNull();
    expect(await json(await call())).toMatchObject({ ending: 0, ended: 0 });
    expect(h.sent).toHaveLength(1);
  });

  it("emails once after it has ended", async () => {
    rows()[0].trial_ends_at = hours(-5);
    expect(await json(await call())).toMatchObject({ ending: 0, ended: 1 });
    expect(h.sent[0]).toMatchObject({ subject: "Your AdFlo trial has ended" });
  });

  it("releases the claim when sending fails, so tomorrow's run tries again", async () => {
    h.failSend = true;
    expect(await json(await call())).toMatchObject({ ending: 0, failed: 1 });
    expect(rows()[0].trial_ending_sent_at).toBeNull();
    h.failSend = false;
    expect(await json(await call())).toMatchObject({ ending: 1 });
  });

  it("a dry run counts and changes nothing; an owner with no usable email is counted, not mailed", async () => {
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, ending: 1 });
    expect(rows()[0].trial_ending_sent_at).toBeNull();
    rows()[0].owner_email = "not an address";
    expect(await json(await call())).toMatchObject({ noEmail: 1, ending: 0 });
    expect(h.sent).toEqual([]);
  });

  it("skips a trial that has paid", async () => {
    rows()[0].stripe_subscription_id = "sub_1"; rows()[0].billing_status = "active";
    expect(await json(await call())).toMatchObject({ ending: 0, ended: 0 });
  });
});
