import { billingContext, getStripe, logStripeError } from "@/lib/billing/server";
import { priceConfig } from "@/lib/billing/sync";
import { json, readJson, sameOrigin } from "@/lib/dms/server/respond";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Starts a Stripe Checkout for the AdFlo plan (monthly or annual). The client record is attached so the webhook knows whose it is. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: { code: "forbidden", message: "Cross-origin request blocked." } }, 403);
  const ctx = await billingContext();
  if (!ctx.ok) return json({ ok: false, error: { code: "unavailable", message: ctx.message } }, ctx.status);
  const body = (await readJson(req).catch(() => ({}))) as { interval?: unknown };
  const prices = priceConfig();
  const price = body.interval === "year" ? prices.annual : body.interval === "month" ? prices.monthly : undefined;
  if (!price) return json({ ok: false, error: { code: "invalid", message: "Choose monthly or annual billing." } }, 400);
  const c = ctx.client;
  if (c.stripe_subscription_id && !["canceled", "incomplete_expired"].includes(c.billing_status ?? "")) {
    return json({ ok: false, error: { code: "conflict", message: "You already have a subscription. Use Manage billing to change it." } }, 409);
  }
  const origin = siteOrigin(req.url);
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(c.stripe_customer_id ? { customer: c.stripe_customer_id } : { customer_email: ctx.email || c.owner_email || undefined }),
      client_reference_id: c.id,
      metadata: { client_id: c.id },
      subscription_data: { metadata: { client_id: c.id } },
      allow_promotion_codes: true,
      success_url: `${origin}/trial/welcome`,
      cancel_url: `${origin}/trial/continue`,
    });
    return json({ ok: true, data: { url: session.url } });
  } catch (e) {
    logStripeError("checkout", e);
    return json({ ok: false, error: { code: "internal", message: "Could not start checkout. Try again, or email support@adflo.pro." } }, 502);
  }
}
