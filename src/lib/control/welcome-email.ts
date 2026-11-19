import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOnboardingEmail } from "@/lib/mail/onboarding";
import { siteOrigin } from "@/lib/site-url";
import { logAppError } from "./errors";
import { ownerTarget, type MailResult } from "./invitation-email";
import { welcomeEmailSubject, welcomeMessage } from "./workspace";

type WelcomeResult = MailResult;

/**
 * Emails the welcome message to a client's owner from the onboarding@ alias and ticks the "Welcome message sent" step. It is
 * not the invitation: it goes out once the owner has signed up and is in the workspace, and says what to do first. It is
 * refused until someone has joined, and the step is ticked only when the email really went out.
 */
export async function emailWelcome(supabase: SupabaseClient, staffUserId: string, clientId: string, requestUrl: string): Promise<WelcomeResult> {
  const t = await ownerTarget(supabase, clientId);
  if (!t.ok) return t;
  // Staff are not members of client workspaces, so the members table is invisible to them: the same staff-only usage count the
  // account card uses (control_client_usage) says whether anyone has joined.
  const { data: usage } = await supabase.rpc("control_client_usage");
  const row = ((usage ?? []) as { client_id: string; seats_used: number }[]).find((u) => u.client_id === clientId);
  if (!row || Number(row.seats_used) < 1) return { ok: false, code: "not_joined", status: 409, message: "The owner has not signed in yet. Send the welcome message once they have; until then, the invitation is what they need." };
  const text = welcomeMessage({ clientName: t.name, ownerName: t.ownerName, loginUrl: `${siteOrigin(requestUrl)}/login` });
  try {
    await sendOnboardingEmail({ to: t.to, subject: welcomeEmailSubject(t.name), text });
  } catch (e) {
    await logAppError("POST /api/control/clients/:id (welcome email)", e, { status: 502 });
    return { ok: false, code: "mail_failed", status: 502, message: "The email could not be sent. Use Copy welcome message and send it yourself." };
  }
  const { error } = await supabase.from("client_checklist").upsert({ client_id: clientId, step: "welcome_sent", done_by: staffUserId }, { onConflict: "client_id,step", ignoreDuplicates: true });
  if (error) throw error;
  return { ok: true, emailedTo: t.to };
}
