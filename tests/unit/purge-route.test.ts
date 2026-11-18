import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: null as null | Record<string, unknown> }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn(), createServiceSupabase: () => mocks.admin }));

import { GET, POST } from "@/app/api/maintenance/purge-workspaces/route";

const SECRET = "a-long-enough-cron-secret";
const req = (headers: Record<string, string> = {}) => new Request("https://x.test/api/maintenance/purge-workspaces", { method: "POST", headers });

beforeEach(() => { mocks.admin = null; });
afterEach(() => vi.unstubAllEnvs());

describe("purge-workspaces route", () => {
  it("refuses to run without a strong CRON_SECRET", async () => {
    expect((await POST(req({ authorization: "Bearer x" }))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "short");
    expect((await POST(req({ authorization: "Bearer short" }))).status).toBe(503);
  });
  it("rejects a wrong secret before touching the database", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const rpc = vi.fn();
    mocks.admin = { rpc };
    expect((await POST(req())).status).toBe(401);
    expect((await GET(req({ "x-cron-secret": "nope" }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("runs the purge with the Vercel Cron header, records the run and returns counts only", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const upsert = vi.fn(async () => ({ error: null }));
    mocks.admin = { rpc: vi.fn(async () => ({ data: [], error: null })), from: vi.fn(() => ({ upsert })) };
    const res = await GET(req({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, found: 0, deleted: 0, failed: 0, objectsRemoved: 0, accountsRemoved: 0 });
    expect((upsert.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({ job: "purge-workspaces", ok: true });
  });
  it("returns a generic 500 and records the failure when the list cannot be read", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const upsert = vi.fn(async () => ({ error: null }));
    mocks.admin = { rpc: vi.fn(async () => ({ data: null, error: { message: "secret detail" } })), from: vi.fn(() => ({ upsert })) };
    const res = await POST(req({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret detail");
    expect((upsert.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({ job: "purge-workspaces", ok: false });
  });
});
