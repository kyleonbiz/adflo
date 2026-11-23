import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/server";
import { applyStatusRule, patchFromSubscription, priceConfig, type SubLike } from "@/lib/billing/sync";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * Stripe calls this when a subscription starts, changes or ends. The signature is checked against STRIPE_WEBHOOK_SECRET
 * before anything is read, each event is applied once, and only the client's billing fields, plan, seats and
 * status change. Not behind sign-in: Stripe is the caller, and the signature is the proof.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createServiceSupabase();
  if (!secret || !process.env.STRIPE_SECRET_KEY || !admin) return reply(503, { ok: false, error: "Not configured." });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return reply(400, { ok: false, error: "Missing signature." });
  const raw = await req.text();
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(raw, signature, secret); } catch { return reply(400, { ok: false, error: "Bad signature." }); }

  // Already handled? (Stripe retries.) The insert fails on a repeat id.
  const seen = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (seen.error) return seen.error.code === "23505" ? reply(200, { ok: true, duplicate: true }) : reply(500, { ok: false, error: "Could not record event." });

  try {
    let sub: SubLike | null = null;
    let clientId: string | undefined;
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode !== "subscription" || !s.subscription) return reply(200, { ok: true, ignored: true });
      clientId = s.client_reference_id ?? s.metadata?.client_id ?? undefined;
      sub = (await getStripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id)) as unknown as SubLike;
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const s = event.data.object as Stripe.Subscription;
      clientId = s.metadata?.client_id || undefined;
      sub = s as unknown as SubLike;
    } else {
      return reply(200, { ok: true, ignored: true });
    }

    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const found = clientId
      ? await admin.from("clients").select("id, status").eq("id", clientId).maybeSingle()
      : await admin.from("clients").select("id, status").eq("stripe_customer_id", customer).maybeSingle();
    if (!found.data) return reply(200, { ok: true, unmatched: true });
    const patch = applyStatusRule(patchFromSubscription(sub, priceConfig()), found.data.status as string);
    const { error } = await admin.from("clients").update(patch).eq("id", found.data.id);
    if (error) {
      await admin.from("stripe_events").delete().eq("id", event.id); // let Stripe retry
      return reply(500, { ok: false, error: "Could not update the client." });
    }
    return reply(200, { ok: true });
  } catch {
    await admin.from("stripe_events").delete().eq("id", event.id);
    return reply(500, { ok: false, error: "Could not handle the event." });
  }
}
