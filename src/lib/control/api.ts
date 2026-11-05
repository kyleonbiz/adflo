import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { findStaff, type Staff } from "./gate";
import { logAppError } from "./errors";
import { sameOrigin } from "@/lib/dms/server/respond";
import { canEditClients, type StaffRole } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const fail = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/** Runs a staff-only API handler that changes clients. Anyone who is not active owner/support staff gets a plain refusal. */
export async function staffRoute(req: Request, handler: (ctx: { supabase: SupabaseClient; staff: Staff }) => Promise<Response>, minRole: Extract<StaffRole, "support" | "owner"> = "support"): Promise<Response> {
  if (!sameOrigin(req)) return fail(403, "forbidden", "Cross-origin request blocked.");
  if (!getSupabaseEnv()) return fail(503, "no_database", "The database is not connected.");
  const supabase = await createServerSupabase();
  const staff = await findStaff(supabase);
  if (!staff) return fail(403, "forbidden", "This area is for AdFlo staff.");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return fail(403, "mfa_required", "Enter your two-factor code first.");
  if (minRole === "owner" ? staff.role !== "owner" : !canEditClients(staff.role)) return fail(403, "read_only", minRole === "owner" ? "Only the Owner can do this." : "Your role can look but not change clients.");
  try {
    return await handler({ supabase, staff });
  } catch (e) {
    await logAppError(`${req.method} ${new URL(req.url).pathname.replace(/[0-9a-f-]{36}/g, ":id")}`, e, { status: 500 });
    return fail(500, "server_error", "Something went wrong. Try again.");
  }
}

export { fail };
