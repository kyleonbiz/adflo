import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({ mode: "live", role: "owner", rpcs: [] as { fn: string; args: Record<string, unknown> }[], info: "2026-11-20T10:00:00Z" as string | null, errCode: "" }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpcs.push({ fn, args });
      if (h.errCode) return { data: null, error: { code: h.errCode } };
      return { data: fn === "calendar_feed_info" ? h.info : null, error: null };
    },
  }),
}));
vi.mock("@/lib/dms/server/context", () => ({
  getDms: async () => ({ mode: h.mode, userId: "u1" }),
  findMembership: async () => ({ workspaceId: "w1", role: h.role }),
}));

import { DELETE, GET, POST } from "@/app/api/calendar/feed/route";
import { hashToken } from "@/lib/control/token";

const req = (method: string, headers: Record<string, string> = {}) => new Request("https://adflo.pro/api/calendar/feed", { method, headers: { host: "adflo.pro", ...headers } });
const j = async (r: Response) => (await r.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message: string } };

beforeEach(() => { h.mode = "live"; h.role = "owner"; h.rpcs = []; h.info = "2026-11-20T10:00:00Z"; h.errCode = ""; });

describe("calendar feed management", () => {
  it("tells any member whether a link exists, never the link", async () => {
    h.role = "viewer";
    expect((await j(await GET())).data).toEqual({ on: true, createdAt: "2026-11-20T10:00:00Z" });
    h.info = null;
    expect((await j(await GET())).data).toEqual({ on: false, createdAt: null });
  });

  it("makes a link once, storing only its hash", async () => {
    const body = await j(await POST(req("POST")));
    const url = String(body.data!.url);
    expect(url).toMatch(/^https:\/\/adflo\.pro\/api\/calendar\/feed\/[A-Za-z0-9_-]{43}\.ics$/);
    const token = url.split("/").pop()!.replace(".ics", "");
    expect(h.rpcs).toEqual([{ fn: "calendar_feed_set", args: { p_workspace: "w1", p_token_hash: hashToken(token) } }]);
    expect(JSON.stringify(h.rpcs)).not.toContain(token);
  });

  it("only owners and admins can make or turn off the link", async () => {
    for (const role of ["editor", "viewer"]) {
      h.role = role;
      expect((await POST(req("POST"))).status).toBe(403);
      expect((await DELETE(req("DELETE"))).status).toBe(403);
    }
    expect(h.rpcs).toEqual([]);
    h.role = "admin";
    expect((await DELETE(req("DELETE"))).status).toBe(200);
    expect(h.rpcs[0].fn).toBe("calendar_feed_off");
  });

  it("blocks cross-site requests, needs a connected workspace, and reports a database refusal", async () => {
    expect((await POST(req("POST", { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    h.mode = "demo";
    expect((await POST(req("POST"))).status).toBe(503);
    h.mode = "live"; h.errCode = "42501";
    expect((await POST(req("POST"))).status).toBe(403);
  });
});
