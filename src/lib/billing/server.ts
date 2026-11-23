import "server-only";
import Stripe from "stripe";
import { findMembership } from "@/lib/dms/server/context";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY && !!createServiceSupabase();
export const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export interface BillingClient {
  id: string; name: string; owner_email: string; status: string; plan: string;
  stripe_customer_id: string | null; stripe_subscription_id: string | null; billing_status: string | null;
  billing_interval: string | null; current_period_end: string | null; cancel_at_period_end: boolean;
}
export const BILLING_COLUMNS = "id, name, owner_email, status, plan, stripe_customer_id, stripe_subscription_id, billing_status, billing_interval, current_period_end, cancel_at_period_end";

export type BillingContext =
  | { ok: true; admin: SupabaseClient; client: BillingClient; email: string }
  | { ok: false; status: number; message: string };

/**
 * Who is asking, and which client record is theirs. Billing belongs to the workspace's owner or an admin; the client
 * record is read with the service role because customers cannot read it themselves.
 */
export async function billingContext(): Promise<BillingContext> {
  if (!getSupabaseEnv() || !stripeConfigured()) return { ok: false, status: 501, message: "Online billing is not set up yet. Email support@adflo.pro." };
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, status: 401, message: "Sign in first." };
  const membership = await findMembership(supabase, data.user.id);
  if (!membership) {
    // A free trial has no workspace yet: its client record is found by the owner's own (verified) email.
    const admin = createServiceSupabase();
    const email = (data.user.email ?? "").trim().toLowerCase();
    const { data: trial } = admin && email ? await admin.from("clients").select(BILLING_COLUMNS).eq("self_serve", true).eq("owner_email", email).is("workspace_id", null).maybeSingle() : { data: null };
    if (!admin || !trial) return { ok: false, status: 404, message: "No workspace found." };
    return { ok: true, admin, client: trial as BillingClient, email };
  }
  if (membership.role !== "owner" && membership.role !== "admin") return { ok: false, status: 403, message: "Only the workspace owner or an admin can change billing." };
  const admin = createServiceSupabase();
  if (!admin) return { ok: false, status: 501, message: "Online billing is not set up yet. Email support@adflo.pro." };
  const { data: client } = await admin.from("clients").select(BILLING_COLUMNS).eq("workspace_id", membership.workspaceId).maybeSingle();
  if (!client) return { ok: false, status: 409, message: "Your account is not set up for online billing yet. Email support@adflo.pro." };
  return { ok: true, admin, client: client as BillingClient, email: data.user.email ?? "" };
}

/** Logs why a Stripe call failed: its error type, code, parameter and message (never keys or customer details), so a failed checkout can be diagnosed from the server log. */
export function logStripeError(where: string, e: unknown): void {
  const r = (e && typeof e === "object" ? e : {}) as { type?: string; code?: string; param?: string; statusCode?: number; message?: string };
  console.error(`[billing] ${where} failed:`, JSON.stringify({ type: r.type, code: r.code, param: r.param, status: r.statusCode, message: typeof r.message === "string" ? r.message.slice(0, 300) : undefined }));
}
