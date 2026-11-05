import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ env: true, user: { id: "u1" } as { id: string } | null, member: { workspaceId: "w1" } as { workspaceId: string } | null, features: null as unknown, throws: false }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => (m.env ? { url: "x", key: "y" } : null) }));
vi.mock("@/lib/dms/server/context", () => ({ findMembership: async () => { if (m.throws) throw new Error("boom"); return m.member; } }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: m.user } }) },
    rpc: async () => ({ data: m.features }),
  }),
}));

import { planIncludes } from "@/lib/control/plan-server";
import { TIERS } from "@/lib/control/tiers";

beforeEach(() => { m.env = true; m.user = { id: "u1" }; m.member = { workspaceId: "w1" }; m.features = null; m.throws = false; });

describe("planIncludes", () => {
  it("refuses OCR and the Claude assistant on Core, allows them on Core +", async () => {
    m.features = [...TIERS[0].features];
    expect(await planIncludes("ocr")).toBe(false);
    expect(await planIncludes("assistant_ai")).toBe(false);
    expect(await planIncludes("invoices")).toBe(true);
    m.features = [...TIERS[1].features];
    expect(await planIncludes("ocr")).toBe(true);
    expect(await planIncludes("assistant_ai")).toBe(true);
  });
  it("allows everything whenever it cannot tell", async () => {
    m.features = null; expect(await planIncludes("ocr")).toBe(true);      // legacy plan
    m.env = false; m.features = []; expect(await planIncludes("ocr")).toBe(true); // preview
    m.env = true; m.user = null; expect(await planIncludes("ocr")).toBe(true);
    m.user = { id: "u1" }; m.member = null; expect(await planIncludes("ocr")).toBe(true);
    m.member = { workspaceId: "w1" }; m.throws = true; expect(await planIncludes("ocr")).toBe(true);
  });
});
