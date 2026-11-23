import { describe, expect, it } from "vitest";
import { applyStatusRule, patchFromSubscription, priceConfig, type SubLike } from "@/lib/billing/sync";

const cfg = { monthly: "price_m", annual: "price_y", extraSeat: "price_seat" };
const sub = (over: Partial<SubLike> = {}, items: SubLike["items"]["data"] = [{ price: { id: "price_m" }, quantity: 1 }]): SubLike =>
  ({ id: "sub_1", status: "active", customer: "cus_1", current_period_end: 1_800_000_000, items: { data: items }, ...over });

describe("patchFromSubscription", () => {
  it("puts a Core + subscription on the plan with its 3 included seats and marks the client active", () => {
    expect(patchFromSubscription(sub(), cfg)).toMatchObject({
      plan: "core +", seats_limit: 3, status: "active", billing_status: "active", billing_interval: "month",
      stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", cancel_at_period_end: false,
    });
  });
  it("knows the annual price and adds extra seats on top of the included ones", () => {
    const p = patchFromSubscription(sub({}, [{ price: { id: "price_y" }, quantity: 1 }, { price: { id: "price_seat" }, quantity: 4 }]), cfg);
    expect(p).toMatchObject({ billing_interval: "year", seats_limit: 7 });
  });
  it("reads the period end from the items when the subscription has none", () => {
    const p = patchFromSubscription(sub({ current_period_end: undefined }, [{ price: { id: "price_m" }, quantity: 1, current_period_end: 1_900_000_000 }]), cfg);
    expect(p.current_period_end).toBe(new Date(1_900_000_000 * 1000).toISOString());
  });
  it("keeps the client active while payment is overdue, and cancels it when the subscription ends", () => {
    expect(patchFromSubscription(sub({ status: "past_due" }), cfg)).toMatchObject({ status: "active", billing_status: "past_due" });
    expect(patchFromSubscription(sub({ status: "canceled" }), cfg)).toMatchObject({ status: "cancelled", billing_status: "canceled" });
  });
  it("leaves plan, seats and status alone for a price it does not know or a status it does not map", () => {
    const p = patchFromSubscription(sub({ status: "incomplete" }, [{ price: { id: "price_other" }, quantity: 1 }]), cfg);
    expect(p).not.toHaveProperty("plan");
    expect(p).not.toHaveProperty("seats_limit");
    expect(p).not.toHaveProperty("status");
  });
  it("accepts a customer object and records a pending cancellation", () => {
    expect(patchFromSubscription(sub({ customer: { id: "cus_9" }, cancel_at_period_end: true }), cfg)).toMatchObject({ stripe_customer_id: "cus_9", cancel_at_period_end: true });
  });
});

describe("applyStatusRule and priceConfig", () => {
  it("never lifts a suspension", () => {
    const p = patchFromSubscription(sub(), cfg);
    expect(applyStatusRule(p, "suspended")).not.toHaveProperty("status");
    expect(applyStatusRule(p, "trial")).toHaveProperty("status", "active");
  });
  it("reads price ids from the environment and ignores blanks", () => {
    expect(priceConfig({ STRIPE_PRICE_CORE_PLUS_MONTHLY: "price_m", STRIPE_PRICE_CORE_PLUS_ANNUAL: "" })).toEqual({ monthly: "price_m", annual: undefined, extraSeat: undefined });
  });
});
