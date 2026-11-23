import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verify: null as null | ((raw: string, sig: string) => unknown),
  inserted: [] as string[], duplicate: false,
  client: { id: "c1", status: "trial" } as { id: string; status: string } | null,
  updates: [] as Record<string, unknown>[], updateError: false,
}));

vi.mock("@/lib/billing/server", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: (raw: string, sig: string) => { if (!m.verify) throw new Error("bad"); return m.verify(raw, sig); } },
    subscriptions: { retrieve: async () => ({ id: "sub_1", status: "active", customer: "cus_1", items: { data: [{ price: { id: "price_m" }, quantity: 1 }] }, current_period_end: 1_800_000_000 }) },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceSupabase: () => ({
    from: (table: string) => {
      if (table === "stripe_events") return {
        insert: async (row: { id: string }) => (m.duplicate ? { error: { code: "23505" } } : (m.inserted.push(row.id), { error: null })),
        delete: () => ({ eq: async () => ({}) }),
      };
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: m.client }) }) }),
        update: (patch: Record<string, unknown>) => ({ eq: async () => { m.updates.push(patch); return { error: m.updateError ? { message: "x" } : null }; } }),
      };
    },
  }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

const post = (body = "{}", sig: string | null = "t=1,v1=x") => POST(new Request("http://x/api/stripe/webhook", { method: "POST", body, headers: sig ? { "stripe-signature": sig } : {} }));
const subEvent = (type = "customer.subscription.updated", metadata: Record<string, string> = { client_id: "c1" }) => ({
  id: "evt_1", type, data: { object: { id: "sub_1", status: "active", customer: "cus_1", metadata, items: { data: [{ price: { id: "price_m" }, quantity: 1 }] }, current_period_end: 1_800_000_000 } },
});

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
  process.env.STRIPE_PRICE_CORE_PLUS_MONTHLY = "price_m";
  m.verify = () => subEvent(); m.inserted = []; m.duplicate = false; m.client = { id: "c1", status: "trial" }; m.updates = []; m.updateError = false;
});

describe("Stripe webhook", () => {
  it("refuses a request with no signature or a bad one, and changes nothing", async () => {
    expect((await post("{}", null)).status).toBe(400);
    m.verify = null;
    expect((await post()).status).toBe(400);
    expect(m.updates).toEqual([]);
  });
  it("is off until Stripe is configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await post()).status).toBe(503);
  });
  it("puts the client on Core + when a subscription is active", async () => {
    expect((await post()).status).toBe(200);
    expect(m.updates[0]).toMatchObject({ plan: "core +", seats_limit: 3, status: "active", billing_status: "active", stripe_customer_id: "cus_1" });
  });
  it("applies an event once: a repeated delivery changes nothing", async () => {
    m.duplicate = true;
    const res = await post();
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(m.updates).toEqual([]);
  });
  it("does not lift a suspension", async () => {
    m.client = { id: "c1", status: "suspended" };
    await post();
    expect(m.updates[0]).not.toHaveProperty("status");
  });
  it("ignores events it does not handle and subscriptions it cannot match to a client", async () => {
    m.verify = () => ({ id: "evt_2", type: "charge.succeeded", data: { object: {} } });
    expect(await (await post()).json()).toMatchObject({ ignored: true });
    m.verify = () => subEvent();
    m.client = null;
    expect(await (await post()).json()).toMatchObject({ unmatched: true });
    expect(m.updates).toEqual([]);
  });
  it("answers 500 when the update fails, so Stripe retries", async () => {
    m.updateError = true;
    expect((await post()).status).toBe(500);
  });
});
