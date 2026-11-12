import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RecordsSyncError } from "@/lib/records/remote";
import { PERSISTED_KINDS, createSupabaseBackend } from "@/lib/records/supabase-backend";

type Call = { table: string; op: string; args?: unknown; filters: Record<string, unknown> };
type Answer = { data?: unknown; error?: { code?: string; message?: string } | null };

/** A stand-in for the Supabase client: records every request and answers from a script. */
function fakeClient(answer: (c: Call) => Answer) {
  const calls: Call[] = [];
  const make = (table: string): unknown => {
    const call: Call = { table, op: "select", filters: {} };
    const done = () => { calls.push(call); const a = answer(call); return Promise.resolve({ data: a.data ?? null, error: a.error ?? null }); };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => { call.filters[k] = v; return q; },
      in: (k: string, v: unknown) => { call.filters[k] = v; return q; },
      order: () => q,
      range: (from: number, to: number) => { call.filters.range = [from, to]; return done(); },
      maybeSingle: () => done(),
      upsert: (rows: unknown, opts: unknown) => { call.op = "upsert"; call.args = { rows, opts }; return done(); },
      delete: () => { call.op = "delete"; return q; },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => done().then(ok, bad),
    };
    return q;
  };
  return { client: { from: make } as unknown as SupabaseClient, calls };
}

const WS = "11111111-1111-4111-8111-111111111111";

describe("PERSISTED_KINDS", () => {
  it("starts with licenses and projects (tasks live inside projects)", () => {
    expect([...PERSISTED_KINDS]).toEqual(["licenses", "projects"]);
  });
});

describe("load", () => {
  it("reads this workspace's records of one kind, and merges the row id into each record", async () => {
    const { client, calls } = fakeClient((c) => c.table === "workspace_records"
      ? { data: [{ id: "l1", data: { name: "State license" } }] }
      : { data: { kind: "licenses" } });
    const res = await createSupabaseBackend(client, WS).load("licenses");
    expect(res).toEqual({ records: [{ id: "l1", name: "State license" }], saved: true });
    expect(calls[0]!.filters).toMatchObject({ workspace_id: WS, kind: "licenses" });
  });
  it("reports never-saved when there are no rows and no marker", async () => {
    const { client } = fakeClient((c) => (c.table === "workspace_records" ? { data: [] } : { data: null }));
    expect(await createSupabaseBackend(client, WS).load("projects")).toEqual({ records: [], saved: false });
  });
  it("reports saved-but-empty when only the marker exists", async () => {
    const { client } = fakeClient((c) => (c.table === "workspace_records" ? { data: [] } : { data: { kind: "projects" } }));
    expect(await createSupabaseBackend(client, WS).load("projects")).toEqual({ records: [], saved: true });
  });
  it("reads every page when there are more rows than one request returns", async () => {
    const page = (n: number, from: number) => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}`, data: {} }));
    const { client, calls } = fakeClient((c) => {
      if (c.table !== "workspace_records") return { data: null };
      const [from] = c.filters.range as [number, number];
      return { data: from === 0 ? page(1000, 0) : page(5, 1000) };
    });
    const res = await createSupabaseBackend(client, WS).load("licenses");
    expect(res.records).toHaveLength(1005);
    expect(calls.filter((c) => c.table === "workspace_records").map((c) => c.filters.range)).toEqual([[0, 999], [1000, 1999]]);
  });
  it("fails (to be retried) when the database errors", async () => {
    const { client } = fakeClient(() => ({ error: { message: "boom" } }));
    await expect(createSupabaseBackend(client, WS).load("licenses")).rejects.toMatchObject({ problem: "failed" });
  });
});

describe("save", () => {
  it("upserts each record as a row of its own, scoped to the workspace", async () => {
    const { client, calls } = fakeClient(() => ({}));
    await createSupabaseBackend(client, WS).save("projects", { upserts: [{ id: "p1", name: "Audit", tasks: [] }], deletes: [], markSaved: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: "workspace_records", op: "upsert" });
    expect(calls[0]!.args).toEqual({
      rows: [{ workspace_id: WS, kind: "projects", id: "p1", data: { id: "p1", name: "Audit", tasks: [] } }],
      opts: { onConflict: "workspace_id,kind,id" },
    });
  });
  it("deletes by id, only inside this workspace and kind", async () => {
    const { client, calls } = fakeClient(() => ({}));
    await createSupabaseBackend(client, WS).save("licenses", { upserts: [], deletes: ["a", "b"], markSaved: false });
    expect(calls[0]).toMatchObject({ table: "workspace_records", op: "delete", filters: { workspace_id: WS, kind: "licenses", id: ["a", "b"] } });
  });
  it("marks the service as saved without disturbing an existing marker", async () => {
    const { client, calls } = fakeClient(() => ({}));
    await createSupabaseBackend(client, WS).save("licenses", { upserts: [], deletes: [], markSaved: true });
    expect(calls[0]).toMatchObject({ table: "workspace_record_sets", op: "upsert" });
    expect((calls[0]!.args as { opts: unknown }).opts).toEqual({ onConflict: "workspace_id,kind", ignoreDuplicates: true });
  });
  it("sends large changes in chunks", async () => {
    const { client, calls } = fakeClient(() => ({}));
    const upserts = Array.from({ length: 450 }, (_, i) => ({ id: `r${i}` }));
    await createSupabaseBackend(client, WS).save("licenses", { upserts, deletes: [], markSaved: false });
    expect(calls.map((c) => (c.args as { rows: unknown[] }).rows.length)).toEqual([200, 200, 50]);
  });
  it("says 'denied' for a permission error and 'failed' for anything else", async () => {
    const denied = fakeClient(() => ({ error: { code: "42501", message: "new row violates row-level security policy" } }));
    await expect(createSupabaseBackend(denied.client, WS).save("licenses", { upserts: [{ id: "a" }], deletes: [], markSaved: false }))
      .rejects.toEqual(new RecordsSyncError("denied"));
    const other = fakeClient(() => ({ error: { code: "08006", message: "connection failure" } }));
    await expect(createSupabaseBackend(other.client, WS).save("licenses", { upserts: [{ id: "a" }], deletes: [], markSaved: false }))
      .rejects.toEqual(new RecordsSyncError("failed"));
  });
});
