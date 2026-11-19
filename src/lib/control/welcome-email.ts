import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { siteOrigin } from "@/lib/site-url";
import { logAppError } from "./errors";
import { issueInviteLink } from "./invite";
import { welcomeEmailSubject, welcomeMessage } from "./workspace";

const expiryDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

export type WelcomeResult =
  | { ok: true; emailedTo: string }
  | { ok: false; code: "not_found" | "no_owner_email" | "no_workspace" | "mail_off" | "mail_failed" | "no_invite"; status: number; message: string };

/**
 * Emails the welcome message to a client's owner from the onboarding@ alias and ticks the "Welcome message sent" step.
 * The step is ticked only when the email really went out. Shared by the "Email welcome message" button and by the
 * actions that create or renew the invitation, so the owner is told as soon as the invitation exists.
 */
export async function emailWelcome(supabase: SupabaseClient, staffUserId: string, clientId: string, requestUrl: string): Promise<WelcomeResult> {
  const { data: client } = await supabase.from("clients").select("name, owner_name, owner_email, workspace_id").eq("id", clientId).maybeSingle();
  if (!client) return { ok: false, code: "not_found", status: 404, message: "Client not found." };
  const to = typeof client.owner_email === "string" ? client.owner_email.trim() : "";
  if (!EMAIL.test(to)) return { ok: false, code: "no_owner_email", status: 409, message: "Add the owner's email to the client first (Edit)." };
  if (!client.workspace_id) return { ok: false, code: "no_workspace", status: 409, message: "Create or connect the workspace first, so the owner has somewhere to land." };
  if (!onboardingMailReady()) return { ok: false, code: "mail_off", status: 503, message: "Email is not switched on yet (SMTP_USER and SMTP_PASSWORD are not set). Use Copy welcome message instead." };

  // The link is made only once the email is certain to be tried, and it replaces any earlier link for this invitation.
  const invite = await issueInviteLink(supabase, clientId, siteOrigin(requestUrl));
  if (!invite.ok) return { ok: false, code: "no_invite", status: invite.status, message: invite.message };
  const text = welcomeMessage({ clientName: String(client.name ?? ""), ownerName: String(client.owner_name ?? ""), ownerEmail: to, inviteUrl: invite.link, expiresOn: expiryDay(invite.expiresAt) });
  try {
    await sendOnboardingEmail({ to, subject: welcomeEmailSubject(String(client.name ?? "")), text });
  } catch (e) {
    // Only the kind of error and where it happened are kept, so the Monitoring page can show that email is failing.
    await logAppError("POST /api/control/clients/:id (welcome email)", e, { status: 502 });
    return { ok: false, code: "mail_failed", status: 502, message: "The email could not be sent. Use Copy welcome message and send it yourself." };
  }
  const { error } = await supabase.from("client_checklist").upsert({ client_id: clientId, step: "welcome_sent", done_by: staffUserId }, { onConflict: "client_id,step", ignoreDuplicates: true });
  if (error) throw error;
  return { ok: true, emailedTo: to };
}
