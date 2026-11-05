import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ rpc }) }));

import { POST } from "@/app/api/agreement/accept/route";
import { resetRateLimits } from "@/lib/dms/server/rate-limit";

const TOKEN = "A".repeat(43);
const GOOD = { token: TOKEN, name: "Pat Lee", email: "pat@example.com", agree: true };

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/agreement/accept", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", ...headers },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  rpc.mockReset();
  resetRateLimits();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/agreement/accept", () => {
  // The stored hash must never be a credential: the database hashes the secret itself (migration 19). If the app sent a
  // hash here, anyone able to read the agreements table could accept for a client by calling the public function.
  it("sends the link's secret to the database, never a hash of it", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const res = await POST(post(GOOD));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("agreement_public_accept");
    expect(args).toEqual({ p_token: TOKEN, p_name: "Pat Lee", p_email: "pat@example.com" });
    expect(JSON.stringify(args)).not.toMatch(/[0-9a-f]{64}/);
    expect(args).not.toHaveProperty("p_token_hash");
  });

  it("reports an unknown, expired or used link as 409", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(post(GOOD))).status).toBe(409);
  });

  it("never reaches the database with a malformed secret", async () => {
    for (const token of ["short", "A".repeat(44), "A".repeat(42) + "!", 123, null]) {
      const res = await POST(post({ ...GOOD, token }));
      expect(res.status, String(token)).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request", async () => {
    const res = await POST(post(GOOD, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not leak database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "relation agreements_sent does not exist" } });
    const res = await POST(post(GOOD));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("agreements_sent");
  });
});
