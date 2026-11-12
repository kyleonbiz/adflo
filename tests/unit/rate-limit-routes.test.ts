import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchange = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async (name: string) => (name === "control_reset_target" ? { data: "client-1" } : { data: null }));
const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ auth: { exchangeCodeForSession: exchange }, rpc }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { resetPasswordForEmail } }) }));
vi.mock("@/lib/control/api", async () => {
  const { NextResponse } = await import("next/server");
  return {
    fail: (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status }),
    staffRoute: (_req: Request, h: (c: unknown) => Promise<Response>) => h({ supabase: { rpc }, staff: { email: "owner@adflo.test" } }),
  };
});

import { GET as callback } from "@/app/auth/callback/route";
import { POST as reset } from "@/app/api/control/password-reset/route";
import { resetRateLimits } from "@/lib/dms/server/rate-limit";

beforeEach(() => {
  resetRateLimits();
  exchange.mockClear();
  resetPasswordForEmail.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("auth callback rate limit", () => {
  it("stops exchanging codes after 30 requests a minute from one client", async () => {
    const req = () => new Request("http://localhost/auth/callback?code=abc", { headers: { "x-forwarded-for": "1.2.3.4" } });
    for (let i = 0; i < 30; i++) await callback(req());
    expect(exchange).toHaveBeenCalledTimes(30);
    const res = await callback(req());
    expect(exchange).toHaveBeenCalledTimes(30);
    expect(res.headers.get("location")).toContain("/login?error=callback");
  });
});

describe("staff password-reset rate limit", () => {
  const post = (email: string) =>
    new Request("http://localhost/api/control/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
  it("allows 3 emails an hour to one address, then answers 429", async () => {
    for (let i = 0; i < 3; i++) expect((await reset(post("pat@example.com"))).status).toBe(200);
    expect((await reset(post("pat@example.com"))).status).toBe(429);
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(3);
  });
  it("caps one staff member at 10 emails an hour across addresses", async () => {
    for (let i = 0; i < 10; i++) expect((await reset(post(`u${i}@example.com`))).status).toBe(200);
    expect((await reset(post("u11@example.com"))).status).toBe(429);
  });
});
