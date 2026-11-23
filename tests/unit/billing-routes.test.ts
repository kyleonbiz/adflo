import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ctx: null as unknown, created: [] as Record<string, unknown>[], portal: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/billing/server", () => ({
  billingContext: async () => m.ctx,
  getStripe: () => ({
    checkout: { sessions: { create: async (a: Record<string, unknown>) => { m.created.push(a); return { url: "https://checkout.stripe.test/s" }; } } },
    billingPortal: { sessions: { create: async (a: Record<string, unknown>) => { m.portal.push(a); return { url: "https://portal.stripe.test/p" }; } } },
  }),
}));

import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as portal } from "@/app/api/billing/portal/route";

const client = (over: Record<string, unknown> = {}) => ({ id: "c1", name: "Acme", owner_email: "o@acme.test", status: "trial", plan: "adflo", stripe_customer_id: null, stripe_subscription_id: null, billing_status: null, ...over });
const ok = (c = client()) => ({ ok: true, admin: {}, client: c, email: "o@acme.test" });
const req = (url: string, body: unknown) => new Request(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", host: "localhost" } });

beforeEach(() => {
  m.ctx = ok(); m.created = []; m.portal = [];
  process.env.STRIPE_PRICE_CORE_PLUS_MONTHLY = "price_m"; process.env.STRIPE_PRICE_CORE_PLUS_ANNUAL = "price_y";
});

describe("checkout", () => {
  it("starts a subscription for the chosen interval and tags it with the client", async () => {
    const res = await checkout(req("/api/billing/checkout", { interval: "year" }));
    expect((await res.json()).data.url).toContain("checkout.stripe.test");
    expect(m.created[0]).toMatchObject({ mode: "subscription", client_reference_id: "c1", metadata: { client_id: "c1" }, line_items: [{ price: "price_y", quantity: 1 }] });
  });
  it("refuses an unknown interval, and a client that already subscribes", async () => {
    expect((await checkout(req("/api/billing/checkout", { interval: "week" }))).status).toBe(400);
    m.ctx = ok(client({ stripe_subscription_id: "sub_1", billing_status: "active" }));
    expect((await checkout(req("/api/billing/checkout", { interval: "month" }))).status).toBe(409);
    expect(m.created).toEqual([]);
  });
  it("passes on who may not (not set up, not signed in, not an owner)", async () => {
    for (const status of [501, 401, 403, 409]) {
      m.ctx = { ok: false, status, message: "no" };
      expect((await checkout(req("/api/billing/checkout", { interval: "month" }))).status).toBe(status);
    }
  });
  it("blocks cross-site requests", async () => {
    const r = new Request("http://localhost/api/billing/checkout", { method: "POST", body: "{}", headers: { "sec-fetch-site": "cross-site" } });
    expect((await checkout(r)).status).toBe(403);
  });
});

describe("portal", () => {
  it("opens the portal for the client's Stripe customer only", async () => {
    expect((await portal(req("/api/billing/portal", {}))).status).toBe(409);
    m.ctx = ok(client({ stripe_customer_id: "cus_1" }));
    const res = await portal(req("/api/billing/portal", {}));
    expect((await res.json()).data.url).toContain("portal.stripe.test");
    expect(m.portal[0]).toMatchObject({ customer: "cus_1" });
  });
});
