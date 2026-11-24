import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { clients: { name: string; workspace_id: string | null; status: string }[]; records: Rec[]; members: { workspace_id: string; email: string; role: string }[]; failUpdates?: boolean }

const h = vi.hoisted(() => ({ db: null as unknown, sent: [] as Record<string, unknown>[], failSend: false }));
const DB = () => h.db as Db;

function fakeAdmin() {
  const exec = (q: { table: string; op: string; patch?: { data: Record<string, unknown> }; f: Record<string, unknown> }) => {
    const db = DB();
    if (q.table === "clients") return { data: db.clients.filter((c) => (q.f["in:status"] as string[] | undefined)?.includes(c.status) && c.workspace_id), error: null };
    if (q.table === "workspace_members") return { data: db.members.filter((m) => m.workspace_id === q.f.workspace_id && (q.f["in:role"] as string[]).includes(m.role)), error: null };
    const rows = db.records.filter((r) => r.workspace_id === q.f.workspace_id && r.kind === q.f.kind && (q.f.id === undefined || r.id === q.f.id));
    if (q.op === "update") {
      if (db.failUpdates) return { error: { message: "x" } };
      for (const r of rows) r.data = q.patch!.data;
      return { error: null };
    }
    return { data: rows.map((r) => ({ id: r.id, data: r.data })), error: null };
  };
  return {
    from(table: string) {
      const q: { table: string; op: string; patch?: { data: Record<string, unknown> }; f: Record<string, unknown> } = { table, op: "select", f: {} };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (patch: { data: Record<string, unknown> }) => { q.op = "update"; q.patch = patch; return chain; },
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

import { GET } from "@/app/api/maintenance/vendor-chase/route";

const SECRET = "s".repeat(24);
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const call = (query = "") => GET(new Request(`http://localhost/api/maintenance/vendor-chase${query}`, { headers: { authorization: `Bearer ${SECRET}` } }));
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

const vendor = (id: string, o: Record<string, unknown> = {}): Rec => ({
  workspace_id: "w1", kind: "vendors", id,
  data: { name: `Vendor ${id}`, category: "Supplies", contactName: "Sam", email: `${id}@vendor.test`, phone: "", taxId: "", notes: "", status: "active", createdOn: "2026-01-01",
    documents: [{ id: "d1", type: "Certificate of insurance", required: true, receivedOn: "2026-01-01", expiresOn: day(10) }, { id: "d2", type: "W-9", required: true, receivedOn: "2026-01-01", expiresOn: null }], ...o },
});
const settings = (data: Record<string, unknown>): Rec => ({ workspace_id: "w1", kind: "settings", id: "config", data });
const ON = { automation: { vendorChase: true }, details: { email: "office@acme.test" } };

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  h.sent = []; h.failSend = false;
  h.db = { clients: [{ name: "Acme Roofing", workspace_id: "w1", status: "active" }], records: [settings(ON), vendor("v1")], members: [] } satisfies Db;
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/maintenance/vendor-chase", () => {
  it("refuses without the cron secret", async () => {
    expect((await GET(new Request("http://localhost/api/maintenance/vendor-chase"))).status).toBe(401);
  });

  it("emails a vendor whose certificate is expiring, in the business's name, with replies going to the business", async () => {
    const res = await json(await call());
    expect(res).toMatchObject({ ok: true, workspacesOn: 1, due: 1, sent: 1, failed: 0 });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "v1@vendor.test", from: "Acme Roofing via AdFlo <reminders@adflo.pro>", replyTo: "office@acme.test" });
    expect(String(h.sent[0].subject)).toContain("Acme Roofing");
    expect(String(h.sent[0].text)).toContain("Certificate of insurance");
  });

  it("writes the email on the vendor's file, so the next one waits a week", async () => {
    await call();
    const notes = DB().records.find((r) => r.id === "v1")!.data.activity as { kind: string; by: string; text: string }[];
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: "reminder", by: "AdFlo (automatic)" });
    h.sent = [];
    expect(await json(await call())).toMatchObject({ due: 0, sent: 0 }); // again the same day: nothing more goes out
    expect(h.sent).toHaveLength(0);
  });

  it("does nothing for a workspace that has not switched it on", async () => {
    DB().records[0] = settings({ automation: { vendorChase: false }, details: { email: "office@acme.test" } });
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, sent: 0 });
    DB().records.shift(); // no settings saved at all
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, sent: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("skips clients that are suspended or cancelled", async () => {
    DB().clients[0].status = "suspended";
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, sent: 0 });
  });

  it("counts on a dry run and sends and saves nothing", async () => {
    const before = JSON.stringify(DB().records);
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, due: 1, sent: 0 });
    expect(h.sent).toHaveLength(0);
    expect(JSON.stringify(DB().records)).toBe(before);
  });

  it("leaves out vendors with no email, that owe nothing, or that have gone quiet", async () => {
    const quiet = Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, on: day(-30 + i * 7), kind: "reminder", text: "r", by: "x" }));
    DB().records.push(vendor("noemail", { email: "" }), vendor("fine", { documents: [{ id: "d", type: "W-9", required: true, receivedOn: "2026-01-01", expiresOn: null }] }), vendor("quiet", { activity: quiet }));
    expect(await json(await call())).toMatchObject({ due: 1, sent: 1 }); // only v1
    expect(h.sent.map((m) => m.to)).toEqual(["v1@vendor.test"]);
  });

  it("takes the note back off when the email cannot be sent, so tomorrow tries again", async () => {
    h.failSend = true;
    expect(await json(await call())).toMatchObject({ sent: 0, failed: 1 });
    expect(DB().records.find((r) => r.id === "v1")!.data.activity).toEqual([]);
    h.failSend = false;
    expect(await json(await call())).toMatchObject({ sent: 1, failed: 0 });
  });

  it("sends nothing when the note cannot be saved first", async () => {
    DB().failUpdates = true;
    expect(await json(await call())).toMatchObject({ sent: 0, failed: 1 });
    expect(h.sent).toHaveLength(0);
  });

  it("falls back to the workspace owner's email for replies, and skips the workspace when there is none", async () => {
    DB().records[0] = settings({ automation: { vendorChase: true } }); // no business email saved
    expect(await json(await call())).toMatchObject({ sent: 0, noReplyAddress: 1 });
    DB().members.push({ workspace_id: "w1", email: "owner@acme.test", role: "owner" });
    expect(await json(await call())).toMatchObject({ sent: 1 });
    expect(h.sent[0]).toMatchObject({ replyTo: "owner@acme.test" });
  });

  it("only touches the workspace that switched it on", async () => {
    DB().clients.push({ name: "Other Co", workspace_id: "w2", status: "active" });
    DB().records.push({ ...vendor("o1"), workspace_id: "w2" });
    await call();
    expect(h.sent.map((m) => m.to)).toEqual(["v1@vendor.test"]);
  });
});
