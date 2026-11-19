import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { siteOrigin } from "@/lib/site-url";
import { logAppError } from "./errors";
import { issueInviteLink } from "./invite";
import { invitationEmailSubject, invitationMessage } from "./workspace";
import { SENDABLE_EMAIL } from "./patterns";

const expiryDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export type OwnerMailCode = "not_found" | "no_owner_email" | "no_workspace" | "mail_off" | "mail_failed" | "no_invite" | "not_joined";
export type MailResult = { ok: true; emailedTo: string } | { ok: false; code: OwnerMailCode; status: number; message: string };
type OwnerTarget = { ok: true; to: string; name: string; ownerName: string; workspaceId: string } | { ok: false; code: OwnerMailCode; status: number; message: string };

/** The client's owner as an email target, or why they cannot be emailed yet. Shared by the invitation and the welcome. */
export async function ownerTarget(supabase: SupabaseClient, clientId: string): Promise<OwnerTarget> {
  const { data: client } = await supabase.from("clients").select("name, owner_name, owner_email, workspace_id").eq("id", clientId).maybeSingle();
  if (!client) return { ok: false, code: "not_found", status: 404, message: "Client not found." };
  const to = typeof client.owner_email === "string" ? client.owner_email.trim() : "";
  if (!SENDABLE_EMAIL.test(to)) return { ok: false, code: "no_owner_email", status: 409, message: "Add the owner's email to the client first (Edit)." };
  if (!client.workspace_id) return { ok: false, code: "no_workspace", status: 409, message: "Create or connect the workspace first, so the owner has somewhere to land." };
  if (!onboardingMailReady()) return { ok: false, code: "mail_off", status: 503, message: "Email is not switched on yet (SMTP_USER and SMTP_PASSWORD are not set). Use the Copy button instead." };
  return { ok: true, to, name: String(client.name ?? ""), ownerName: String(client.owner_name ?? ""), workspaceId: String(client.workspace_id) };
}

/**
 * Emails the owner their invitation from the onboarding@ alias: a link to confirm it, which is what lets them create their
 * account. It makes a fresh link each time (the earlier one stops working). It ticks nothing: the invitation itself is what
 * ticks "Owner invited". The welcome message is a different email, sent once the owner is in (see welcome-email.ts).
 */
export async function emailInvitation(supabase: SupabaseClient, clientId: string, requestUrl: string): Promise<MailResult> {
  const t = await ownerTarget(supabase, clientId);
  if (!t.ok) return t;
  const invite = await issueInviteLink(supabase, clientId, siteOrigin(requestUrl));
  if (!invite.ok) return { ok: false, code: "no_invite", status: invite.status, message: invite.message };
  const text = invitationMessage({ clientName: t.name, ownerName: t.ownerName, ownerEmail: t.to, inviteUrl: invite.link, expiresOn: expiryDay(invite.expiresAt) });
  try {
    await sendOnboardingEmail({ to: t.to, subject: invitationEmailSubject(t.name), text });
  } catch (e) {
    // Only the kind of error and where it happened are kept, so the Monitoring page can show that email is failing.
    await logAppError("POST /api/control/clients/:id (invitation email)", e, { status: 502 });
    return { ok: false, code: "mail_failed", status: 502, message: "The email could not be sent. Use Copy invitation and send it yourself." };
  }
  return { ok: true, emailedTo: t.to };
}
