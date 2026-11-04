import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { parseResetEmail } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

/**
 * Sends a client's owner or member a password-reset email. Staff never see or set the password, or even the link.
 * Allowed only for emails that belong to a client; every send is written to the audit log.
 */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const parsed = parseResetEmail(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.errors.email);
    const { email } = parsed.value;
    const { data: clientId } = await supabase.rpc("control_reset_target", { p_email: email });
    if (!clientId) return fail(404, "not_a_client", "That email is not a client owner or member. Add it to the client first.");
    const env = getSupabaseEnv();
    if (!env) return fail(503, "no_database", "The database is not connected.");
    // A stateless client, so the staff member's own session and cookies are never involved.
    const mailer = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
    const { error } = await mailer.auth.resetPasswordForEmail(email, { redirectTo: `${new URL(req.url).origin}/reset-password` });
    if (error) return fail(502, "email_failed", "The email could not be sent. Wait a minute and try again.");
    await supabase.rpc("control_log", { p_action: "password_reset.sent", p_entity: "password_reset", p_entity_id: email, p_detail: { client_id: clientId, by: staff.email } });
    return NextResponse.json({ ok: true });
  });
}
