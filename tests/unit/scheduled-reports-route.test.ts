import { beforeEach, describe, expect, it, vi } from "vitest";

type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { clients: { name: string; workspace_id: string; status: string }[]; records: Rec[]; members: { workspace_id: string; email: string; role: string }[]; activity: Record<string, unknown>[]; failUpdates?: boolean }
const h = vi.hoisted(() => ({ db: null as unknown, sent: [] as Record<string, unknown>[], failSend: false }));
const DB = () => h.db as Db;

function fakeAdmin() {
  type Q = { table: string; op: string; payload?: unknown; f: Record<string, unknown> };
  const exec = (q: Q) => {
    const db = DB();
    if (q.table === "clients") return { data: db.clients.filter((c) => (q.f["in:status"] as string[]).includes(c.status)), error: null };
    if (q.table === "workspace_members") return { data: db.members.filter((m) => m.workspace_id === q.f.workspace_id && (q.f["in:role"] as string[]).includes(m.role)), error: null };
    if (q.table === "workspace_activity") { db.activity.push(...(q.payload as Record<string, unknown>[])); return { error: null }; }
    const rows = db.records.filter((r) => r.workspace_id === q.f.workspace_id && r.kind === q.f.kind && (q.f.id === undefined || r.id === q.f.id));
    if (q.op === "update") {
      if (db.failUpdates) return { error: { message: "x" } };
      for (const r of rows) r.data = (q.payload as { data: Record<string, unknown> }).data;
      return { error: null };
    }
    return { data: rows.map((r) => ({ id: r.id, data: r.data })), error: null };
  };
  return {
    from(table: string) {
      const q: Q = { table, op: "select", f: {} };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (p: unknown) => { q.op = "update"; q.payload = p; return chain; },
        upsert: (p: unknown) => { q.op = "upsert"; q.payload = p; return chain; },
        eq: (k: string, v: unknown) => { q.f[k] = v; return chain; },
        in: (k: string, v: unknown) => { q.f[`in:${k}`] = v; return chain; },
        not: () => chain, order: () => chain, limit: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(exec(q)),
      };
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => fakeAdmin() }));
vi.mock("@/lib/control/job-runs", () => ({ recordJobRun: async () => undefined }));
vi.mock("@/lib/mail/send", () => ({
  reminderMailReady: () => true,
  sendReminderEmail: async (m: Record<string, unknown>) => { if (h.failSend) throw new Error("down"); h.sent.push(m); },
}));

import { GET } from "@/app/api/maintenance/scheduled-reports/route";

const SECRET = "s".repeat(24);
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const call = (q = "", headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) => GET(new Request(`http://localhost/api/maintenance/scheduled-reports${q}`, { headers }));
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const rec = (kind: string, id: string, data: Record<string, unknown>): Rec => ({ workspace_id: "w1", kind, id, data });
const schedule = (o: Record<string, unknown> = {}) => rec("schedules", "s1", { reportId: "overview", every: "monthly", nextOn: today, recipients: "", ...o });
const invoice = (id: string) => rec("invoices", id, { number: `INV-${id}`, client: "Zed Co", description: "x", items: [], issuedOn: day(-10), dueOn: day(-2), amountCents: 125000, status: "sent", recurrence: "none", reminderDays: [], paymentMethods: [] });
const sched = () => DB().records.find((r) => r.kind === "schedules")!;

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  h.sent = []; h.failSend = false;
  h.db = {
    clients: [{ name: "Acme Roofing", workspace_id: "w1", status: "active" }],
    records: [schedule(), invoice("1")],
    members: [{ workspace_id: "w1", email: "owner@acme.test", role: "owner" }],
    activity: [],
  } satisfies Db;
});

describe("scheduled-reports job", () => {
  it("refuses without the secret", async () => {
    expect((await call("", {})).status).toBe(401);
  });

  it("emails a due report to the owners, moves its date on, and writes it to the activity log", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, due: 1, sent: 1 });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "owner@acme.test" });
    expect(String(h.sent[0].subject)).toContain("Business summary");
    expect(String(h.sent[0].text)).toMatch(/INVOICES/i); // the invoices report is in it
    expect(String(sched().data.nextOn) > today).toBe(true);
    expect(DB().activity).toEqual([expect.objectContaining({ data: expect.objectContaining({ by: "AdFlo", area: "Reports" }) })]);
    expect(await json(await call())).toMatchObject({ due: 0, sent: 0 }); // not sent twice
  });

  it("sends to the addresses on the schedule instead, and ignores a bad one", async () => {
    sched().data.recipients = "a@acme.test, nope, b@acme.test";
    await call();
    expect(h.sent.map((m) => m.to)).toEqual(["a@acme.test", "b@acme.test"]);
  });

  it("sends one service's report, and nothing when it is not due yet", async () => {
    sched().data.reportId = "invoices";
    await call();
    expect(String(h.sent[0].subject)).toContain("Invoices");
    h.sent = []; sched().data.nextOn = day(5);
    expect(await json(await call())).toMatchObject({ due: 0 });
    expect(h.sent).toEqual([]);
  });

  it("puts the date back when nothing could be sent, and counts a workspace with nobody to send to", async () => {
    h.failSend = true;
    const before = String(sched().data.nextOn);
    expect(await json(await call())).toMatchObject({ sent: 0, failed: 1 });
    expect(sched().data.nextOn).toBe(before);
    h.failSend = false; DB().members = [];
    expect(await json(await call())).toMatchObject({ noRecipient: 1, sent: 0 });
  });

  it("a dry run counts and changes nothing; suspended clients are skipped; bad records are ignored", async () => {
    DB().records.push(rec("invoices", "bad", { number: 5 }), rec("schedules", "bad", { reportId: 7 }));
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, due: 1, sent: 0 });
    expect(sched().data.nextOn).toBe(today);
    DB().clients[0].status = "suspended";
    expect(await json(await call())).toMatchObject({ due: 0 });
  });
});
