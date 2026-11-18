import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => null, createServerSupabase: async () => ({}) }));
import { GET } from "@/app/api/maintenance/onboarding-reminders/route";

const SECRET = "s".repeat(24);
const call = (headers: Record<string, string> = {}) => GET(new Request("http://localhost/api/maintenance/onboarding-reminders", { headers }));

beforeEach(() => vi.stubEnv("CRON_SECRET", SECRET));
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/maintenance/onboarding-reminders", () => {
  it("answers 503 when no cron secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call()).status).toBe(503);
  });
  it("refuses a missing or wrong secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call({ authorization: "Bearer nope" })).status).toBe(401);
  });
  it("does nothing, and says so, when switched off", async () => {
    vi.stubEnv("ONBOARDING_AUTO_REMIND", "off");
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, enabled: false });
  });
  it("answers 503 when the database key is missing", async () => {
    expect((await call({ authorization: `Bearer ${SECRET}` })).status).toBe(503);
  });
});
