import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { records: Rec[]; members: { workspace_id: string; email: string; role: string }[]; workspaces: { id: string; name: string }[]; failUpdates?: boolean }

const h = vi.hoisted(() => ({ db: null as unknown, sent: [] as Record<string, unknown>[], failSend: false, mode: "live", role: "editor", user: "u1" }));
const DB = () => h.db as Db;

function fakeDb() {
  type Q = { table: string; op: string; payload?: Record<string, unknown>; f: Record<string, unknown> };
  const exec = (q: Q) => {
    const db = DB();
    if (q.table === "workspaces") return { data: db.workspaces.filter((w) => w.id === q.f.id), error: null };
    if (q.table === "workspace_members") return { data: db.members.filter((m) => m.workspace_id === q.f.workspace_id && (q.f["in:role"] as string[]).includes(m.role)), error: null };
    const rows = db.records.filter((r) => r.workspace_id === q.f.workspace_id && r.kind === q.f.kind && (q.f.id === undefined || r.id === q.f.id));
    if (q.op === "update") {
      if (db.failUpdates) return { error: { message: "x" } };
      for (const r of rows) r.data = q.payload!.data as Record<string, unknown>;
      return { error: null };
    }
    return { data: rows.map((r) => ({ id: r.id, data: r.data })), error: null };
  };
  return {
    from(table: string) {
      const q: Q = { table, op: "select", f: {} };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (payload: Record<string, unknown>) => { q.op = "update"; q.payload = payload; return chain; },
        eq: (k: string, v: unknown) => { q.f[k] = v; return chain; },
        in: (k: string, v: unknown) => { q.f[`in:${k}`] = v; return chain; },
        order: () => chain, limit: () => chain,
        maybeSingle: async () => { const r = exec(q) as { data?: unknown[] }; return { data: r.data?.[0] ?? null, error: null }; },
        then: (resolve: (v: unknown) => unknown) => resolve(exec(q)),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => fakeDb() }));
vi.mock("@/lib/dms/server/context", () => ({
  getDms: async () => ({ mode: h.mode, userId: h.user }),
  findMembership: async () => ({ workspaceId: "w1", role: h.role, displayName: "Kyle" }),
}));
vi.mock("@/lib/mail/send", () => ({
  reminderMailReady: () => true,
  reminderAddress: () => "reminders@adflo.pro",
  sendReminderEmail: async (m: Record<string, unknown>) => { if (h.failSend) throw new Error("smtp down"); h.sent.push(m); },
}));

import { POST } from "@/app/api/packets/send/route";
import { PACKETS, startPacket, toggleItem, theirItems } from "@/lib/packets/logic";

const today = new Date().toISOString().slice(0, 10);
const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/packets/send", { method: "POST", headers: { "content-type": "application/json", host: "localhost", ...headers }, body: JSON.stringify(body) }));
const json = async (res: Response) => (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } };

const packet = (o: Record<string, unknown> = {}, templateId = "pk-hire"): Rec => {
  const a = startPacket(PACKETS.find((p) => p.id === templateId)!, "Jordan Cruz", "jordan@example.com", "2026-11-01", "p1");
  const { id: _id, ...data } = { ...a, ...o };
  void _id;
  return { workspace_id: "w1", kind: "packets", id: "p1", data: data as unknown as Record<string, unknown> };
};
const settings = (details: Record<string, unknown> = { email: "office@acme.test" }): Rec => ({ workspace_id: "w1", kind: "settings", id: "config", data: { details } });
const stored = () => DB().records.find((r) => r.kind === "packets")!.data;

beforeEach(() => {
  h.sent = []; h.failSend = false; h.mode = "live"; h.role = "editor"; h.user = `u${Math.random()}`; // a fresh user each test, so the rate limit never carries over
  h.db = { records: [settings(), packet()], members: [{ workspace_id: "w1", email: "boss@acme.test", role: "owner" }], workspaces: [{ id: "w1", name: "Acme Roofing" }] } satisfies Db;
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/packets/send", () => {
  it("emails the packet in the business's name and records when it was sent", async () => {
    const res = await json(await call({ id: "p1" }));
    expect(res).toMatchObject({ ok: true, data: { emailedTo: "jordan@example.com", sentOn: today, remindedOn: [] } });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "jordan@example.com", from: "Acme Roofing via AdFlo <reminders@adflo.pro>", replyTo: "office@acme.test", subject: "Acme Roofing: paperwork to complete" });
    expect(String(h.sent[0].text)).toContain("/form/");
    expect(stored().sentOn).toBe(today);
  });

  it("counts sending again as a reminder, and says so on the packet", async () => {
    await call({ id: "p1" });
    h.sent = [];
    const res = await json(await call({ id: "p1" }));
    expect(res.data).toMatchObject({ sentOn: today, remindedOn: [today] });
    expect(String(h.sent[0].subject)).toBe("Reminder: paperwork for Acme Roofing");
    expect(stored().remindedOn).toEqual([today]);
  });

  it("refuses when everything the person had to provide is already in", async () => {
    let a = startPacket(PACKETS.find((p) => p.id === "pk-hire")!, "Jordan Cruz", "jordan@example.com", "2026-11-01", "p1");
    for (const i of theirItems(a)) a = toggleItem(a, i.id, "2026-11-02");
    DB().records[1] = packet({ items: a.items });
    const res = await call({ id: "p1" });
    expect(res.status).toBe(409);
    expect(h.sent).toHaveLength(0);
  });

  it("refuses a packet with no email, one that does not exist, and a missing id", async () => {
    DB().records[1] = packet({ email: "" });
    expect((await call({ id: "p1" })).status).toBe(409);
    expect((await call({ id: "nope" })).status).toBe(404);
    expect((await call({})).status).toBe(400);
    expect(h.sent).toHaveLength(0);
    expect(stored().sentOn).toBeUndefined();
  });

  it("is for members who can edit, in a connected workspace, from this site", async () => {
    h.role = "viewer";
    expect((await call({ id: "p1" })).status).toBe(403);
    h.role = "editor"; h.mode = "dev";
    expect((await call({ id: "p1" })).status).toBe(503);
    h.mode = "live";
    expect((await call({ id: "p1" }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(h.sent).toHaveLength(0);
  });

  it("takes the record back when the email cannot be sent", async () => {
    h.failSend = true;
    const res = await call({ id: "p1" });
    expect(res.status).toBe(502);
    expect(stored().sentOn).toBeUndefined();
  });

  it("sends nothing when the record cannot be saved first", async () => {
    DB().failUpdates = true;
    expect((await call({ id: "p1" })).status).toBe(500);
    expect(h.sent).toHaveLength(0);
  });

  it("will not send with nowhere for replies to go", async () => {
    DB().records[0] = settings({});
    DB().members.length = 0;
    const res = await json(await call({ id: "p1" }));
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("no_reply_address");
    expect(h.sent).toHaveLength(0);
    expect(stored().sentOn).toBeUndefined();
  });

  it("limits how many packets one person can email in an hour", async () => {
    h.user = "rate-limited-user";
    let last = 200;
    for (let i = 0; i < 31; i++) { DB().records[1] = packet(); last = (await call({ id: "p1" })).status; }
    expect(last).toBe(429);
  });
});
