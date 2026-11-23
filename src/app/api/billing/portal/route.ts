import { billingContext, getStripe } from "@/lib/billing/server";
import { json, sameOrigin } from "@/lib/dms/server/respond";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Opens Stripe's customer portal (payment method, invoices, plan changes, cancel) for the signed-in workspace. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: { code: "forbidden", message: "Cross-origin request blocked." } }, 403);
  const ctx = await billingContext();
  if (!ctx.ok) return json({ ok: false, error: { code: "unavailable", message: ctx.message } }, ctx.status);
  if (!ctx.client.stripe_customer_id) return json({ ok: false, error: { code: "conflict", message: "There is no subscription to manage yet." } }, 409);
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: ctx.client.stripe_customer_id, return_url: `${siteOrigin(req.url)}/app/help` });
    return json({ ok: true, data: { url: session.url } });
  } catch {
    return json({ ok: false, error: { code: "internal", message: "Could not open billing. Try again, or email support@adflo.pro." } }, 502);
  }
}
