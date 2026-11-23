import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAppError } from "@/lib/control/errors";
import { sameOrigin } from "@/lib/dms/server/respond";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const supportFail = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  NextResponse.json({ ok: false, error: { code, message, ...(fields ? { fields } : {}) } }, { status });

/** What the support functions in the database raise, in plain words. */
function describe(e: { message?: string; code?: string }): Response | null {
  const m = e.message ?? "";
  if (m.includes("rate_limited")) return supportFail(429, "rate_limited", "That is a lot of requests in a short time. Wait a little and try again.");
  if (m.includes("not_found") || e.code === "P0002") return supportFail(404, "not_found", "Request not found.");
  if (m.includes("not_a_member") || e.code === "42501") return supportFail(403, "forbidden", "Sign in with your AdFlo workspace account to contact support.");
  if (m.includes("invalid") || e.code === "22023") return supportFail(400, "invalid", "Check what you wrote and try again.");
  return null;
}

/** Runs a signed-in member's support call. The database decides whose requests they are; this only checks the sign-in and the origin. */
export async function supportRoute(req: Request, handler: (ctx: { supabase: SupabaseClient; userId: string; email: string }) => Promise<Response>): Promise<Response> {
  if (!sameOrigin(req)) return supportFail(403, "forbidden", "Cross-origin request blocked.");
  if (!getSupabaseEnv()) return supportFail(503, "no_database", "Support is not available in the preview.");
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return supportFail(401, "unauthenticated", "Please sign in.");
  try {
    return await handler({ supabase, userId: data.user.id, email: data.user.email ?? "" });
  } catch (e) {
    const known = describe(e as { message?: string; code?: string });
    if (known) return known;
    await logAppError(`${req.method} ${new URL(req.url).pathname.replace(/[0-9a-f-]{36}/g, ":id")}`, e, { status: 500 });
    return supportFail(500, "server_error", "Something went wrong. Try again, or email support@adflo.pro.");
  }
}

/** Throws the database error so supportRoute can word it. */
export function must<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  return r.data;
}
