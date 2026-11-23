import { billingContext } from "@/lib/billing/server";
import { json } from "@/lib/dms/server/respond";

export const dynamic = "force-dynamic";

/** The signed-in workspace's billing state, for the Plans & limits panel. Never returns Stripe ids. */
export async function GET() {
  const ctx = await billingContext();
  if (!ctx.ok) return json({ ok: false, error: { code: "unavailable", message: ctx.message } }, ctx.status);
  const c = ctx.client;
  return json({ ok: true, data: { plan: c.plan, status: c.billing_status, interval: c.billing_interval, periodEnd: c.current_period_end, cancelAtPeriodEnd: c.cancel_at_period_end, subscribed: !!c.stripe_subscription_id } });
}
