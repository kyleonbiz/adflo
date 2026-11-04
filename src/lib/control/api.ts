import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { findStaff, type Staff } from "./gate";
import { canEditClients } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const fail = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/** Runs a staff-only API handler that changes clients. Anyone who is not active owner/support staff gets a plain refusal. */
export async function staffRoute(handler: (ctx: { supabase: SupabaseClient; staff: Staff }) => Promise<Response>): Promise<Response> {
  if (!getSupabaseEnv()) return fail(503, "no_database", "The database is not connected.");
  const supabase = await createServerSupabase();
  const staff = await findStaff(supabase);
  if (!staff) return fail(403, "forbidden", "This area is for AdFlo staff.");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return fail(403, "mfa_required", "Enter your two-factor code first.");
  if (!canEditClients(staff.role)) return fail(403, "read_only", "Your role can look but not change clients.");
  try {
    return await handler({ supabase, staff });
  } catch {
    return fail(500, "server_error", "Something went wrong. Try again.");
  }
}

export { fail };
