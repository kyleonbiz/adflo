import { TIERS } from "@/lib/control/tiers";

/** The parts of a Stripe subscription we read. Stripe moved `current_period_end` onto the items in newer API versions, so both are accepted. */
export interface SubLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  items: { data: { price: { id: string; recurring?: { interval?: string } | null }; quantity?: number | null; current_period_end?: number }[] };
}

/** Stripe price ids, read from the environment. Only the plan prices are required. */
export interface PriceConfig { monthly?: string; annual?: string; extraSeat?: string }
export const priceConfig = (env: Record<string, string | undefined> = process.env): PriceConfig => ({
  monthly: env.STRIPE_PRICE_CORE_PLUS_MONTHLY || undefined,
  annual: env.STRIPE_PRICE_CORE_PLUS_ANNUAL || undefined,
  extraSeat: env.STRIPE_PRICE_EXTRA_SEAT || undefined,
});

export type ClientPatch = Partial<{
  plan: string; seats_limit: number; status: "active" | "cancelled";
  stripe_customer_id: string; stripe_subscription_id: string; billing_status: string;
  billing_interval: "month" | "year" | null; current_period_end: string | null; cancel_at_period_end: boolean;
}>;

/**
 * What a subscription change means for the client record. Plan and seats follow the Core + prices (included seats plus
 * any extra-seat quantity); the client is active while Stripe says active, trialing or past due (a missed payment is not
 * an automatic lockout, staff decide), and cancelled once the subscription ends. Anything unrecognised is left alone.
 */
export function patchFromSubscription(sub: SubLike, cfg: PriceConfig): ClientPatch {
  const items = sub.items?.data ?? [];
  const planItem = items.find((i) => i.price.id === cfg.monthly || i.price.id === cfg.annual);
  const extra = cfg.extraSeat ? items.filter((i) => i.price.id === cfg.extraSeat).reduce((n, i) => n + (i.quantity ?? 0), 0) : 0;
  const end = sub.current_period_end ?? planItem?.current_period_end ?? items[0]?.current_period_end;
  const interval = planItem ? (planItem.price.id === cfg.annual ? "year" : "month") : null;
  const patch: ClientPatch = {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    billing_status: sub.status,
    billing_interval: interval,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
  if (planItem) { patch.plan = TIERS[0].name; patch.seats_limit = TIERS[0].seatsIncluded + extra; }
  if (["active", "trialing", "past_due"].includes(sub.status)) patch.status = "active";
  else if (["canceled", "incomplete_expired"].includes(sub.status)) patch.status = "cancelled";
  return patch;
}

/** A suspended client stays suspended until staff lift it, whatever Stripe says. */
export function applyStatusRule(patch: ClientPatch, current: string): ClientPatch {
  if (current === "suspended" && patch.status) { const { status: _drop, ...rest } = patch; void _drop; return rest; }
  return patch;
}

/** The label shown to people for a Stripe subscription status. */
export const BILLING_LABEL: Record<string, string> = {
  active: "Active", trialing: "Trial", past_due: "Payment overdue", unpaid: "Unpaid", canceled: "Cancelled", incomplete: "Waiting for payment", incomplete_expired: "Expired", paused: "Paused",
};
