import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mode: "live" as "live" | "dev",
  role: "owner" as string | null,
  rpc: vi.fn(),
  requestedAt: null as string | null,
  docs: [] as { id: string; size_bytes: number }[],
}));

vi.mock("@/lib/dms/server/context", async (orig) => ({
  ...(await orig<typeof import("@/lib/dms/server/context")>()),
  getDms: async () => ({ mode: mocks.mode, userId: "u1", service: {} }),
  findMembership: async () => (mocks.role ? { workspaceId: "w1", role: mocks.role, displayName: "Sam" } : null),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceSupabase: () => null,
  createServerSupabase: async () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const b: Record<string, unknown> = {
        select: () => b, eq: () => b, is: () => b, order: () => b,
        maybeSingle: async () => ({ data: table === "workspaces" ? { id: "w1", name: "Acme", deletion_requested_at: mocks.requestedAt } : null }),
        range: async () => ({ data: mocks.docs, error: null }),
      };
      return b;
    },
  }),
}));

import { DELETE, GET, POST } from "@/app/api/dms/workspace/deletion/route";
import { GET as exportGet } from "@/app/api/dms/export/route";
import { resetRateLimits } from "@/lib/dms/server/rate-limit";
import { DELETION_GRACE_DAYS, deletionDate, deletionDaysLeft } from "@/lib/dms/deletion";

const post = (body: unknown) => new Request("https://x.test/api/dms/workspace/deletion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const del = () => new Request("https://x.test/api/dms/workspace/deletion", { method: "DELETE" });
const get = (url = "https://x.test/api/dms/workspace/deletion") => new Request(url);

beforeEach(() => {
  resetRateLimits();
  mocks.mode = "live"; mocks.role = "owner"; mocks.requestedAt = null; mocks.docs = [];
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
});

describe("deletion dates", () => {
  it("counts the grace period from the request", () => {
    const at = "2026-11-01T00:00:00.000Z";
    expect(deletionDate(at)).toBe("2026-12-01T00:00:00.000Z");
    expect(DELETION_GRACE_DAYS).toBe(30);
    expect(deletionDaysLeft(at, Date.parse("2026-11-21T00:00:00Z"))).toBe(10);
    expect(deletionDaysLeft(at, Date.parse("2026-12-05T00:00:00Z"))).toBe(0);
  });
});

describe("GET /api/dms/workspace/deletion", () => {
  it("says nothing is scheduled", async () => {
    const body = await (await GET(get())).json();
    expect(body.data).toEqual({ scheduledFor: null, daysLeft: 0, graceDays: 30 });
  });
  it("reports the date and days left once requested", async () => {
    mocks.requestedAt = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const body = await (await GET(get())).json();
    expect(body.data.daysLeft).toBe(20);
    expect(typeof body.data.scheduledFor).toBe("string");
  });
  it("needs a connected workspace", async () => {
    mocks.mode = "dev";
    expect((await GET(get())).status).toBe(503);
  });
});

describe("POST /api/dms/workspace/deletion", () => {
  it("lets only the owner start it", async () => {
    for (const role of ["viewer", "editor", "admin"]) {
      mocks.role = role;
      expect((await POST(post({ confirmName: "Acme" }))).status).toBe(403);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("needs the name", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ confirmName: "   " }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes the typed name to the database and returns the new status", async () => {
    const res = await POST(post({ confirmName: "Acme" }));
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("workspace_request_deletion", { p_workspace: "w1", p_confirm: "Acme" });
  });
  it("turns a wrong name into a friendly refusal and hides other database errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "22023", message: "internal detail" } });
    const wrong = await POST(post({ confirmName: "Nope" }));
    expect(wrong.status).toBe(400);
    expect(await wrong.text()).toContain("does not match");
    mocks.rpc.mockResolvedValueOnce({ error: { code: "XX000", message: "secret detail" } });
    const other = await POST(post({ confirmName: "Acme" }));
    expect(other.status).toBe(500);
    expect(await other.text()).not.toContain("secret detail");
  });
});

describe("DELETE /api/dms/workspace/deletion", () => {
  it("lets only the owner cancel", async () => {
    mocks.role = "admin";
    expect((await DELETE(del())).status).toBe(403);
    mocks.role = "owner";
    expect((await DELETE(del())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("workspace_cancel_deletion", { p_workspace: "w1" });
  });
});

describe("GET /api/dms/export", () => {
  it("is for owners and admins only", async () => {
    for (const role of ["viewer", "editor"]) {
      mocks.role = role;
      expect((await exportGet(get("https://x.test/api/dms/export?check=1"))).status).toBe(403);
    }
    mocks.role = "admin";
    expect((await exportGet(get("https://x.test/api/dms/export?check=1"))).status).toBe(200);
  });
  it("needs a connected workspace", async () => {
    mocks.mode = "dev";
    expect((await exportGet(get("https://x.test/api/dms/export?check=1"))).status).toBe(503);
  });
  it("reports the size, and refuses one that is too big, before any download starts", async () => {
    mocks.docs = [{ id: "a", size_bytes: 10 }, { id: "b", size_bytes: 5 }];
    const ok = await (await exportGet(get("https://x.test/api/dms/export?check=1"))).json();
    expect(ok.data).toMatchObject({ documents: 2, bytes: 15, tooLarge: false });
    vi.stubEnv("DMS_EXPORT_MAX_BYTES", "12");
    const big = await exportGet(get("https://x.test/api/dms/export?check=1"));
    expect(big.status).toBe(413);
    vi.unstubAllEnvs();
  });
});
