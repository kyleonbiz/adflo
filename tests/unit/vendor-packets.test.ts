import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { clients: { name: string; workspace_id: string; status: string }[]; records: Rec[]; failPacketInsert?: boolean }
const h = vi.hoisted(() => ({ db: null as unknown, sends: [] as { assignment: { id: string; email: string; sentOn?: string }; kind: string }[], sendResult: { ok: true, emailedTo: "x" } as { ok: boolean; code?: string; message?: string; emailedTo?: string }, throwSend: false, mailReady: true }));
const DB = () => h.db as Db;

function fakeAdmin() {
  type Q = { table: string; op: string; payload?: Record<string, unknown>; f: Record<string, unknown> };
  const exec = (q: Q) => {
    const db = DB();
    if (q.table === "clients") return { data: db.clients.filter((c) => (q.f["in:status"] as string[]).includes(c.status)), error: null };
    if (q.table === "workspace_activity") return { error: null };
    if (q.op === "insert") {
      if (db.failPacketInsert) return { error: { message: "x" } };
      db.records.push(q.payload as unknown as Rec); return { error: null };
    }
    const rows = db.records.filter((r) => r.workspace_id === q.f.workspace_id && r.kind === q.f.kind && (q.f.id === undefined || r.id === q.f.id));
    if (q.op === "update") { for (const r of rows) r.data = q.payload!.data as Record<string, unknown>; return { error: null }; }
    return { data: rows.map((r) => ({ id: r.id, data: r.data })), error: null };
  };
  return {
    from(table: string) {
      const q: Q = { table, op: "select", f: {} };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (p: Record<string, unknown>) => { q.op = "update"; q.payload = p; return chain; },
        insert: (p: Record<string, unknown>) => { q.op = "insert"; q.payload = p; return chain; },
        upsert: () => chain,
        eq: (k: string, v: unknown) => { q.f[k] = v; return chain; },
        in: (k: string, v: unknown) => { q.f[`in:${k}`] = v; return chain; },
        not: () => chain, limit: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(exec(q)),
      };
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => fakeAdmin() }));
vi.mock("@/lib/control/job-runs", () => ({ recordJobRun: async () => undefined }));
vi.mock("@/lib/mail/send", () => ({ reminderMailReady: () => h.mailReady }));
vi.mock("@/lib/packets/server", () => ({
  sendPacketEmail: async (_db: unknown, o: { assignment: { id: string; email: string; sentOn?: string }; kind: string }) => { if (h.throwSend) throw new Error("down"); h.sends.push(o); return h.sendResult; },
}));

import { GET } from "@/app/api/maintenance/vendor-packets/route";
import { packetTargets } from "@/lib/vendors/auto-packet";

const SECRET = "s".repeat(24);
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const call = (q = "", headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) => GET(new Request(`http://localhost/api/maintenance/vendor-packets${q}`, { headers }));
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const vendor = (id: string, o: Record<string, unknown> = {}): Rec => ({ workspace_id: "w1", kind: "vendors", id, data: { name: `Vendor ${id}`, email: `${id}@v.test`, contactName: "Sam Roe", status: "onboarding", createdOn: day(-1), documents: [], ...o } });
const settings = (vendorPacket: unknown): Rec => ({ workspace_id: "w1", kind: "settings", id: "config", data: { automation: { vendorPacket } } });
const packets = () => DB().records.filter((r) => r.kind === "packets");

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  h.sends = []; h.sendResult = { ok: true, emailedTo: "x" }; h.throwSend = false; h.mailReady = true;
  h.db = { clients: [{ name: "Acme Roofing", workspace_id: "w1", status: "active" }], records: [settings("send"), vendor("a")] } satisfies Db;
});

describe("packetTargets", () => {
  const v = (o: Record<string, unknown> = {}) => ({ id: "v", name: "V", email: "v@v.test", contactName: "", status: "onboarding", createdOn: day(-1), documents: [], ...o }) as never;
  it("picks new vendors with an email that were never handled", () => {
    expect(packetTargets([v()], [], today)).toHaveLength(1);
  });
  it("leaves out old vendors, ones without a usable email, inactive ones, ones with a packet or a note already, and future dates", () => {
    expect(packetTargets([v({ createdOn: day(-30) }), v({ email: "" }), v({ email: "nope" }), v({ status: "inactive" }), v({ createdOn: day(5) }), v({ activity: [{ id: "auto-packet-v", on: today, kind: "note", text: "", by: "" }] })], [], today)).toEqual([]);
    expect(packetTargets([v()], [{ email: "V@v.test" }], today)).toEqual([]);
  });
});

describe("vendor-packets job", () => {
  it("refuses without the secret", async () => {
    expect((await call("", {})).status).toBe(401);
  });

  it("starts the packet and emails it, once, and marks the vendor's file", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, started: 1, sent: 1, workspacesOn: 1 });
    expect(packets()).toHaveLength(1);
    expect(packets()[0]).toMatchObject({ id: "pk-auto-a", data: expect.objectContaining({ templateId: "pk-sub", email: "a@v.test", recipient: "Sam Roe", sentOn: today }) });
    expect(h.sends[0]).toMatchObject({ kind: "first" });
    const v = DB().records.find((r) => r.kind === "vendors")!;
    expect((v.data.activity as { id: string }[]).map((n) => n.id)).toEqual(["auto-packet-a"]);
    expect(await json(await call())).toMatchObject({ started: 0, sent: 0 });
    expect(packets()).toHaveLength(1);
  });

  it("in draft mode only starts it", async () => {
    DB().records[0] = settings("draft");
    expect(await json(await call())).toMatchObject({ started: 1, sent: 0 });
    expect(h.sends).toEqual([]);
    expect(packets()[0].data.sentOn).toBeUndefined();
  });

  it("does nothing when off or only looks on, and for a suspended client", async () => {
    for (const v of ["off", true, "SEND", undefined]) { DB().records[0] = settings(v); expect(await json(await call())).toMatchObject({ workspacesOn: 0, started: 0 }); }
    DB().records[0] = settings("send"); DB().clients[0].status = "suspended";
    expect(await json(await call())).toMatchObject({ workspacesOn: 0 });
    expect(packets()).toEqual([]);
  });

  it("leaves the packet as a draft, not marked sent, when the email fails or cannot be sent", async () => {
    h.throwSend = true;
    expect(await json(await call())).toMatchObject({ started: 1, sent: 0, failed: 1 });
    expect(packets()[0].data.sentOn).toBeUndefined();
    h.throwSend = false; DB().records = [settings("send"), vendor("b")]; h.sendResult = { ok: false, code: "no_reply_address", message: "x" };
    expect(await json(await call())).toMatchObject({ started: 1, sent: 0 });
    expect(packets()[0].data.sentOn).toBeUndefined();
  });

  it("takes the mark back when the packet could not be saved, so it is tried again", async () => {
    DB().failPacketInsert = true;
    expect(await json(await call())).toMatchObject({ started: 0, failed: 1 });
    expect((DB().records.find((r) => r.kind === "vendors")!.data.activity as unknown[])).toEqual([]);
  });

  it("a dry run counts and changes nothing; a damaged vendor is skipped", async () => {
    DB().records.push(vendor("bad", { documents: "oops" }));
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, started: 1 });
    expect(packets()).toEqual([]);
  });
});
