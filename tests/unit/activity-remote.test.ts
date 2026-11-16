// @vitest-environment jsdom
// The activity trail with a database connected: loads the newest lines, shows a new line at once and sends it in the
// background (a retry never writes it twice), and never retries a line the database refuses for good.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_ENTRIES, type AuditEntry } from "@/lib/audit/logic";
import {
  ActivityDenied, activityActive, activityFailed, activityList, activityLoading, appendActivity, configureActivity,
  refreshActivity, retryActivity, stopActivity, type ActivityBackend,
} from "@/lib/audit/remote";
import { appendAudit } from "@/lib/audit/storage";
import { createActivityBackend } from "@/lib/audit/supabase-backend";

const entry = (id: string, at = "2026-11-16T10:00:00.000Z", over: Partial<AuditEntry> = {}): AuditEntry => ({
  id, by: "Kyle", verb: "created", what: `invoice ${id}`, area: "Invoices", href: "/app/invoices", at, ...over,
});
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** A "database" for the trail: answers load when released, remembers lines, and can be told to fail or refuse. */
function fakeTrail(initial: AuditEntry[] = []) {
  let release!: () => void;
  const open = new Promise<void>((r) => { release = r; });
  const rows = [...initial];
  const sent: string[] = [];
  const state = { failLoad: false, failAppend: 0, deny: false, loads: 0 };
  const backend: ActivityBackend = {
    async load() {
      state.loads++;
      await open;
      if (state.failLoad) throw new Error("failed");
      return [...rows];
    },
    async append(e) {
      if (state.deny) throw new ActivityDenied();
      if (state.failAppend > 0) { state.failAppend--; throw new Error("failed"); }
      sent.push(e.id);
      if (!rows.some((r) => r.id === e.id)) rows.unshift(e); // the same id twice is ignored, like the database does
    },
  };
  return { backend, rows, sent, state, release: async () => { release(); await tick(); } };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => stopActivity());

describe("loading", () => {
  it("waits for the trail, then shows the workspace's lines newest first", async () => {
    const t = fakeTrail([entry("b", "2026-11-16T11:00:00.000Z"), entry("a")]);
    configureActivity("ws-1", () => t.backend);
    expect(activityActive()).toBe(true);
    expect(activityLoading()).toBe(true);
    expect(activityList()).toEqual([]);
    await t.release();
    expect(activityLoading()).toBe(false);
    expect(activityList()!.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("is not active, and shows nothing of its own, when no database is connected", () => {
    expect(activityActive()).toBe(false);
    expect(activityLoading()).toBe(false);
    expect(activityList()).toBeNull();
  });

  it("a trail that will not load keeps the screens waiting, and tries again", async () => {
    const t = fakeTrail([entry("a")]);
    t.state.failLoad = true;
    configureActivity("ws-1", () => t.backend);
    await t.release();
    expect(activityFailed()).toBe(true);
    expect(activityLoading()).toBe(true); // screens keep waiting rather than showing an empty trail
    t.state.failLoad = false;
    retryActivity();
    await tick();
    expect(activityFailed()).toBe(false);
    expect(activityList()!.map((e) => e.id)).toEqual(["a"]);
  });

  it("connecting twice for the same workspace does not reload it", async () => {
    const t = fakeTrail();
    configureActivity("ws-1", () => t.backend);
    configureActivity("ws-1", () => t.backend);
    await t.release();
    expect(t.state.loads).toBe(1);
  });
});

describe("adding a line", () => {
  it("shows at once and is sent once", async () => {
    const t = fakeTrail([entry("old")]);
    configureActivity("ws-1", () => t.backend);
    await t.release();
    appendActivity(entry("new", "2026-11-16T12:00:00.000Z"));
    expect(activityList()!.map((e) => e.id)).toEqual(["new", "old"]); // before the database has answered
    await tick();
    expect(t.sent).toEqual(["new"]);
  });

  it("a line added while the trail is still loading appears after it, once", async () => {
    const t = fakeTrail([entry("old")]);
    configureActivity("ws-1", () => t.backend);
    appendActivity(entry("early"));
    await t.release();
    await tick();
    expect(activityList()!.map((e) => e.id)).toEqual(["early", "old"]);
    expect(t.sent).toEqual(["early"]);
  });

  it("is retried when the connection drops, and never written twice", async () => {
    const t = fakeTrail();
    configureActivity("ws-1", () => t.backend);
    await t.release();
    t.state.failAppend = 1;
    appendActivity(entry("a"));
    await tick();
    expect(t.sent).toEqual([]);
    expect(activityList()!.map((e) => e.id)).toEqual(["a"]); // still shown while it waits to be saved
    retryActivity();
    await tick();
    expect(t.sent).toEqual(["a"]);
    retryActivity();
    await tick();
    expect(t.sent).toEqual(["a"]);
  });

  it("lines are sent in the order they happened", async () => {
    const t = fakeTrail();
    configureActivity("ws-1", () => t.backend);
    await t.release();
    appendActivity(entry("1"));
    appendActivity(entry("2"));
    appendActivity(entry("3"));
    await tick();
    await tick();
    expect(t.sent).toEqual(["1", "2", "3"]);
  });

  it("a line the database refuses for good is dropped, not retried forever", async () => {
    const t = fakeTrail();
    configureActivity("ws-1", () => t.backend);
    await t.release();
    t.state.deny = true;
    appendActivity(entry("nope"));
    await tick();
    t.state.deny = false;
    retryActivity();
    await tick();
    expect(t.sent).toEqual([]);
  });

  it("the page's own audit call goes to the database, not the browser, once connected", async () => {
    const t = fakeTrail();
    configureActivity("ws-1", () => t.backend);
    await t.release();
    appendAudit(entry("page-1"));
    await tick();
    expect(t.sent).toEqual(["page-1"]);
    expect(window.localStorage.getItem("adflo.audit.v1")).toBeNull();
  });

  it("and to the browser when no database is connected", () => {
    appendAudit(entry("local-1"));
    expect(JSON.parse(window.localStorage.getItem("adflo.audit.v1")!)[0].id).toBe("local-1");
  });
});

describe("refreshing", () => {
  it("picks up other people's lines when the tab is shown again", async () => {
    const t = fakeTrail([entry("a")]);
    configureActivity("ws-1", () => t.backend);
    await t.release();
    t.rows.unshift(entry("by-someone-else", "2026-11-16T13:00:00.000Z"));
    await refreshActivity();
    expect(activityList()!.map((e) => e.id)).toEqual(["by-someone-else", "a"]);
  });

  it("never replaces lines that are still waiting to be sent", async () => {
    const t = fakeTrail([entry("a")]);
    configureActivity("ws-1", () => t.backend);
    await t.release();
    t.state.failAppend = 1;
    appendActivity(entry("mine"));
    await tick();
    t.rows.length = 0; // a stale server copy
    await refreshActivity();
    expect(activityList()!.map((e) => e.id)).toContain("mine");
  });
});

// ---------------------------------------------------------------------------------------------- the Supabase backend

type Call = { table: string; op: string; args?: unknown; filters: Record<string, unknown>; limit?: number };
type Answer = { data?: unknown; error?: { code?: string; message?: string } | null };

function fakeClient(answer: (c: Call) => Answer) {
  const calls: Call[] = [];
  const make = (table: string): unknown => {
    const call: Call = { table, op: "select", filters: {} };
    const done = () => { calls.push(call); const a = answer(call); return Promise.resolve({ data: a.data ?? null, error: a.error ?? null }); };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => { call.filters[k] = v; return q; },
      order: (k: string, o: unknown) => { call.filters[`order:${k}`] = o; return q; },
      limit: (n: number) => { call.limit = n; return done(); },
      upsert: (rows: unknown, opts: unknown) => { call.op = "upsert"; call.args = { rows, opts }; return done(); },
    };
    return q;
  };
  return { client: { from: make } as unknown as SupabaseClient, calls };
}
const WS = "11111111-1111-4111-8111-111111111111";

describe("the Supabase backend", () => {
  it("loads this workspace's newest lines, newest first, and puts the database's own time on each", async () => {
    const { client, calls } = fakeClient(() => ({
      data: [
        { id: "a-2", at: "2026-11-16T12:00:00+00:00", data: { by: "Edith Editor", verb: "paid", what: "invoice INV-2", area: "Invoices", href: "/app/invoices" } },
        { id: "a-1", at: "2026-11-16T11:00:00+00:00", data: { by: "Mia Owner", verb: "created", what: "invoice INV-1", area: "Invoices", href: "/app/invoices", at: "1999-01-01T00:00:00Z" } },
      ],
    }));
    const lines = await createActivityBackend(client, WS).load();
    expect(lines.map((l) => [l.id, l.by, l.at])).toEqual([
      ["a-2", "Edith Editor", "2026-11-16T12:00:00+00:00"],
      ["a-1", "Mia Owner", "2026-11-16T11:00:00+00:00"], // a time the app once wrote into the line is ignored
    ]);
    expect(calls[0]).toMatchObject({ table: "workspace_activity", filters: { workspace_id: WS, "order:at": { ascending: false } }, limit: MAX_ENTRIES });
  });

  it("leaves out a line that is not shaped like one", async () => {
    const { client } = fakeClient(() => ({
      data: [
        { id: "ok", at: "2026-11-16T12:00:00+00:00", data: { by: "A", verb: "created", what: "x", area: "Invoices", href: "/app/invoices" } },
        { id: "bad-area", at: "2026-11-16T12:00:00+00:00", data: { by: "A", verb: "created", what: "x", area: "Nonsense", href: "/app/invoices" } },
        { id: "bad-link", at: "2026-11-16T12:00:00+00:00", data: { by: "A", verb: "created", what: "x", area: "Invoices", href: "https://evil.example" } },
      ],
    }));
    expect((await createActivityBackend(client, WS).load()).map((l) => l.id)).toEqual(["ok"]);
  });

  it("sends only what was done: never the time, the person or the name", async () => {
    const { client, calls } = fakeClient(() => ({}));
    await createActivityBackend(client, WS).append(entry("a-1", "2000-01-01T00:00:00.000Z", { by: "Spoofed Person" }));
    expect(calls[0]).toMatchObject({ table: "workspace_activity", op: "upsert" });
    expect(calls[0]!.args).toEqual({
      rows: { workspace_id: WS, id: "a-1", data: { verb: "created", what: "invoice a-1", area: "Invoices", href: "/app/invoices" } },
      opts: { onConflict: "workspace_id,id", ignoreDuplicates: true },
    });
  });

  it("a refusal for permission is 'denied' (never retried); any other problem is worth a retry", async () => {
    const denied = fakeClient(() => ({ error: { code: "42501", message: "new row violates row-level security policy" } }));
    await expect(createActivityBackend(denied.client, WS).append(entry("x"))).rejects.toBeInstanceOf(ActivityDenied);
    const down = fakeClient(() => ({ error: { code: "08006", message: "connection failure" } }));
    const err = await createActivityBackend(down.client, WS).append(entry("x")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ActivityDenied);
  });

  it("a load that fails is an error to retry", async () => {
    const { client } = fakeClient(() => ({ error: { code: "08006", message: "connection failure" } }));
    await expect(createActivityBackend(client, WS).load()).rejects.toThrow();
  });
});
