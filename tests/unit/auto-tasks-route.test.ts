import { beforeEach, describe, expect, it, vi } from "vitest";

type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { clients: { workspace_id: string; status: string }[]; records: Rec[]; failWrites?: boolean }
const h = vi.hoisted(() => ({ db: null as unknown }));
const DB = () => h.db as Db;

function fakeAdmin() {
  type Q = { table: string; op: string; payload?: Record<string, unknown>; f: Record<string, unknown> };
  const exec = (q: Q) => {
    const db = DB();
    if (q.table === "clients") return { data: db.clients.filter((c) => (q.f["in:status"] as string[]).includes(c.status)), error: null };
    if (q.op === "insert") { if (db.failWrites) return { error: { message: "x" } }; db.records.push(q.payload as unknown as Rec); return { error: null }; }
    const rows = db.records.filter((r) => r.workspace_id === q.f.workspace_id && r.kind === q.f.kind && (q.f.id === undefined || r.id === q.f.id));
    if (q.op === "update") { if (db.failWrites) return { error: { message: "x" } }; for (const r of rows) r.data = q.payload!.data as Record<string, unknown>; return { error: null }; }
    return { data: rows.map((r) => ({ id: r.id, data: r.data })), error: null };
  };
  return {
    from(table: string) {
      const q: Q = { table, op: "select", f: {} };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (p: Record<string, unknown>) => { q.op = "update"; q.payload = p; return chain; },
        insert: (p: Record<string, unknown>) => { q.op = "insert"; q.payload = p; return chain; },
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

import { GET } from "@/app/api/maintenance/auto-tasks/route";

const SECRET = "s".repeat(24);
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const call = (q = "", headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) => GET(new Request(`http://localhost/api/maintenance/auto-tasks${q}`, { headers }));
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const rec = (kind: string, id: string, data: Record<string, unknown>, workspace_id = "w1"): Rec => ({ workspace_id, kind, id, data });
const license = rec("licenses", "l1", { name: "Contractor license", expiresOn: day(10), reminderDays: [30], stage: "not_started" });
const project = () => DB().records.find((r) => r.kind === "projects" && r.id === "auto-follow-ups");

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  h.db = { clients: [{ workspace_id: "w1", status: "active" }], records: [rec("settings", "config", { automation: { autoTasks: true } }), license] } satisfies Db;
});

describe("auto-tasks job", () => {
  it("refuses without the cron secret", async () => {
    expect((await call("", {})).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call()).status).toBe(503);
  });

  it("adds the follow-up project once, and a second run changes nothing", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, added: 1, workspacesOn: 1 });
    expect((project()!.data.tasks as unknown[]).length).toBe(1);
    expect(await json(await call())).toMatchObject({ added: 0 });
    expect((project()!.data.tasks as unknown[]).length).toBe(1);
  });

  it("does not bring back a task that was deleted", async () => {
    await call();
    project()!.data = { ...project()!.data, tasks: [] };
    expect(await json(await call())).toMatchObject({ added: 0 });
    expect(project()!.data.tasks).toEqual([]);
  });

  it("does nothing when the switch is off or only looks true, and for a suspended client", async () => {
    for (const v of ["true", 1, undefined]) { DB().records[0].data = { automation: { autoTasks: v } }; expect(await json(await call())).toMatchObject({ workspacesOn: 0, added: 0 }); }
    DB().records[0].data = { automation: { autoTasks: true } }; DB().clients[0].status = "suspended";
    expect(await json(await call())).toMatchObject({ workspacesOn: 0 });
    expect(project()).toBeUndefined();
  });

  it("a dry run counts and changes nothing", async () => {
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, added: 1 });
    expect(project()).toBeUndefined();
  });

  it("skips a bad record, never overwrites an unreadable project, and counts a failed save", async () => {
    DB().records.push(rec("licenses", "bad", { name: 5 }));
    expect(await json(await call("?dry=1"))).toMatchObject({ added: 1 });
    DB().records.push(rec("projects", "auto-follow-ups", { name: "Mine", tasks: "oops" }));
    expect(await json(await call())).toMatchObject({ added: 0, failed: 1 });
    expect(project()!.data.tasks).toBe("oops");
    DB().records.pop(); DB().failWrites = true;
    expect(await json(await call())).toMatchObject({ added: 0, failed: 1 });
  });
});
