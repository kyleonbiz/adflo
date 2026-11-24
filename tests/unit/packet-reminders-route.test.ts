import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { clients: { name: string; workspace_id: string | null; status: string }[]; records: Rec[]; members: { workspace_id: string; email: string; role: string }[]; failUpdates?: boolean }

const h = vi.hoisted(() => ({ db: null as unknown, sent: [] as Record<string, unknown>[], failSend: false }));
const DB = () => h.db as Db;

function fakeAdmin() {
  type Q = { table: string; op: string; payload?: Record<string, unknown>; f: Record<string, unknown> };
  const exec = (q: Q) => {
    const db = DB();
    if (q.table === "clients") return { data: db.clients.filter((c) => (q.f["in:status"] as string[] | undefined)?.includes(c.status) && c.workspace_id), error: null };
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
  reminderAddress: () => "reminders@adflo.pro",
  sendReminderEmail: async (m: Record<string, unknown>) => { if (h.failSend) throw new Error("smtp down"); h.sent.push(m); },
}));

import { GET } from "@/app/api/maintenance/packet-reminders/route";
import { PACKETS, startPacket, toggleItem, theirItems } from "@/lib/packets/logic";

const SECRET = "s".repeat(24);
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const call = (query = "") => GET(new Request(`http://localhost/api/maintenance/packet-reminders${query}`, { headers: { authorization: `Bearer ${SECRET}` } }));
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

const packet = (id: string, o: Record<string, unknown> = {}, templateId = "pk-hire"): Rec => {
  const a = startPacket(PACKETS.find((p) => p.id === templateId)!, "Jordan Cruz", `${id}@example.com`, day(-10), id);
  const { id: _omit, ...data } = { ...a, sentOn: day(-4), ...o };
  void _omit;
  return { workspace_id: "w1", kind: "packets", id, data: data as unknown as Record<string, unknown> };
};
const settings = (automation: Record<string, unknown>, details: Record<string, unknown> = { email: "owner@acme.test" }): Rec => ({ workspace_id: "w1", kind: "settings", id: "config", data: { automation, details } });
const packets = () => DB().records.filter((r) => r.kind === "packets");
const ON = { packetReminders: true };

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  h.sent = []; h.failSend = false;
  h.db = { clients: [{ name: "Acme Roofing", workspace_id: "w1", status: "active" }], records: [settings(ON), packet("a")], members: [] } satisfies Db;
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/maintenance/packet-reminders", () => {
  it("refuses without the cron secret", async () => {
    expect((await GET(new Request("http://localhost/api/maintenance/packet-reminders"))).status).toBe(401);
  });

  it("reminds the person about what is still outstanding, in the business's name, with replies to the business", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, workspacesOn: 1, due: 1, sent: 1, failed: 0 });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "a@example.com", from: "Acme Roofing via AdFlo <reminders@adflo.pro>", replyTo: "owner@acme.test" });
    expect(String(h.sent[0].subject)).toBe("Reminder: paperwork for Acme Roofing");
    expect(String(h.sent[0].text)).toContain("Safety orientation acknowledgment: http");
    expect(String(h.sent[0].text)).toContain("/form/");
  });

  it("writes the reminder on the packet, so it is not sent again until a week has passed", async () => {
    await call();
    expect(packets()[0].data.remindedOn).toEqual([today]);
    h.sent = [];
    expect(await json(await call())).toMatchObject({ due: 0, sent: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("waits three days after the packet was sent, and sends nothing for a packet that was never emailed", async () => {
    DB().records[1] = packet("a", { sentOn: day(-2) });
    expect(await json(await call())).toMatchObject({ due: 0 });
    DB().records[1] = packet("a", { sentOn: undefined });
    expect(await json(await call())).toMatchObject({ due: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("stops once everything of theirs is in, even if the business's own steps are not", async () => {
    let a = startPacket(PACKETS.find((p) => p.id === "pk-offboard")!, "Jordan Cruz", "j@example.com", day(-10), "o1");
    for (const i of theirItems(a)) a = toggleItem(a, i.id, day(-5));
    const { id: _id, ...data } = { ...a, sentOn: day(-4) };
    void _id;
    DB().records[1] = { workspace_id: "w1", kind: "packets", id: "o1", data: data as unknown as Record<string, unknown> };
    expect(await json(await call())).toMatchObject({ due: 0 });
  });

  it("stops after three reminders", async () => {
    DB().records[1] = packet("a", { remindedOn: [day(-30), day(-23), day(-16)] });
    expect(await json(await call())).toMatchObject({ due: 0 });
  });

  it("does nothing for a workspace that has not switched it on, or a suspended client", async () => {
    DB().records[0] = settings({ packetReminders: false });
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, sent: 0 });
    DB().records[0] = settings(ON); DB().clients[0].status = "suspended";
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, sent: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("counts on a dry run and sends and saves nothing", async () => {
    const before = JSON.stringify(DB().records);
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, due: 1, sent: 0 });
    expect(h.sent).toHaveLength(0);
    expect(JSON.stringify(DB().records)).toBe(before);
  });

  it("takes the record back when the email cannot be sent, so tomorrow tries again", async () => {
    h.failSend = true;
    expect(await json(await call())).toMatchObject({ sent: 0, failed: 1 });
    expect(packets()[0].data.remindedOn ?? []).toEqual([]);
    h.failSend = false;
    expect(await json(await call())).toMatchObject({ sent: 1, failed: 0 });
  });

  it("sends nothing when the record cannot be saved first", async () => {
    DB().failUpdates = true;
    expect(await json(await call())).toMatchObject({ sent: 0, failed: 1 });
    expect(h.sent).toHaveLength(0);
  });

  it("falls back to the owner's email for replies, and does nothing when there is none", async () => {
    DB().records[0] = settings(ON, {});
    expect(await json(await call())).toMatchObject({ sent: 0, noReply: 1 });
    expect(packets()[0].data.remindedOn ?? []).toEqual([]); // not marked as sent
    DB().members.push({ workspace_id: "w1", email: "boss@acme.test", role: "owner" });
    expect(await json(await call())).toMatchObject({ sent: 1 });
    expect(h.sent[0]).toMatchObject({ replyTo: "boss@acme.test" });
  });

  it("only touches the workspace that switched it on", async () => {
    DB().clients.push({ name: "Other Co", workspace_id: "w2", status: "active" });
    DB().records.push({ ...packet("o1"), workspace_id: "w2" });
    await call();
    expect(h.sent.map((m) => m.to)).toEqual(["a@example.com"]);
  });
});
