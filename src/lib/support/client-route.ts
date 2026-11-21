import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { sameOrigin } from "@/lib/dms/server/respond";
import { logAppError } from "@/lib/control/errors";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
export const refuse = (status: number, code: string, message: string, fields?: Record<string, string>) => reply(status, { ok: false, error: { code, message, ...(fields ? { fields } : {}) } });

/**
 * Runs a handler for a signed-in client asking for support. The database decides who may do what (every function checks
 * the caller's own workspace and requests); this only makes sure there is a signed-in person and the request is ours.
 */
export async function clientRoute(req: Request, handler: (ctx: { supabase: SupabaseClient; user: User }) => Promise<Response>): Promise<Response> {
  if (!sameOrigin(req)) return refuse(403, "forbidden", "Cross-origin request blocked.");
  if (!getSupabaseEnv()) return refuse(503, "no_database", "Support requests need a signed-in workspace.");
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return refuse(401, "signed_out", "Sign in to contact support.");
  try {
    return await handler({ supabase, user: data.user });
  } catch (e) {
    await logAppError(`${req.method} ${new URL(req.url).pathname.replace(/[0-9a-f-]{36}/g, ":id")}`, e, { status: 500 });
    return refuse(500, "server_error", "Something went wrong. Try again.");
  }
}

/** The database's plain-language refusals (bad input, too many requests, not yours) pass through; anything else is a server error. */
export function dbRefusal(error: { code?: string; message?: string }): Response | null {
  if (error.code === "22023") return refuse(400, "invalid", error.message ?? "Check what you entered.");
  if (error.code === "54000") return refuse(429, "rate_limited", error.message ?? "Too many requests. Please wait and try again.");
  if (error.code === "P0002") return refuse(404, "not_found", "Request not found.");
  if (error.code === "42501") return refuse(403, "forbidden", "Your account is not set up for support requests yet. Email support@adflo.pro.");
  return null;
}
