import { describe, expect, it, vi } from "vitest";

const seen: { surface?: string; scope?: string }[] = [];
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://x.supabase.co", anonKey: "k" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async (surface?: string) => ({ auth: { signOut: async (o?: { scope?: string }) => { seen.push({ surface, scope: o?.scope }); } } }) }));
import { POST } from "@/app/auth/signout/route";

const post = (fields: Record<string, string>) => {
  const body = new URLSearchParams(fields);
  return POST(new Request("https://www.adflo.pro/auth/signout", { method: "POST", headers: { origin: "https://www.adflo.pro", host: "www.adflo.pro", "content-type": "application/x-www-form-urlencoded" }, body }));
};
const where = (r: Response) => { const u = new URL(r.headers.get("location")!); return u.pathname + u.search; };

describe("POST /auth/signout", () => {
  it("signs out only the side asked for, and only this session", async () => {
    seen.length = 0;
    await post({ to: "control" });
    await post({});
    expect(seen).toEqual([{ surface: "control", scope: "local" }, { surface: "app", scope: "local" }]);
  });
  it("goes to the sign-in screen, or the staff one", async () => {
    expect(where(await post({}))).toBe("/login");
    expect(where(await post({ to: "control" }))).toBe("/control/login");
  });
  it("sends an invited person straight back to their sign-up", async () => {
    expect(where(await post({ next: "/signup?email=kyle%40adflo.pro" }))).toBe("/signup?email=kyle%40adflo.pro");
  });
  it("ignores any other place to go", async () => {
    for (const next of ["https://evil.test/", "//evil.test", "/app/overview", "/signup?email=a@b.c&x=1", "/signup?x=1"]) expect(where(await post({ next }))).toBe("/login");
  });
});
