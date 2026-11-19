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
  const { data: joined } = await supabase.from("workspace_members").select("workspace_id").eq("workspace_id", t.workspaceId).limit(1);
  if (!joined || joined.length === 0) return { ok: false, code: "not_joined", status: 409, message: "The owner has not signed in yet. Send the welcome message once they have; until then, the invitation is what they need." };
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
