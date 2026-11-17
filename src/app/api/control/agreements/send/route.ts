import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { hashToken, newToken } from "@/lib/control/token";
import { parseSendInput } from "@/lib/control/validation";
import { agreementEmail } from "@/lib/mail/onboarding-email";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";

export const dynamic = "force-dynamic";

/**
 * Creates an acceptance link for a client. The link is returned once and only its hash is stored. With `email: true` it is
 * also emailed to the client's owner from the onboarding@ alias; if that email fails the link is still returned, so staff
 * can copy it into their own email instead.
 */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase }) => {
    const parsed = parseSendInput(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.errors.templateId);
    const token = newToken();
    const { error } = await supabase.rpc("control_send_agreement", { p_client: parsed.value.clientId, p_template: parsed.value.templateId, p_token_hash: hashToken(token) });
    if (error) {
      if (error.code === "23503") return fail(404, "not_found", "Client or agreement not found.");
      throw error;
    }
    const link = `${new URL(req.url).origin}/agreement/${token}`;
    const body: { ok: true; link: string; emailedTo?: string; emailError?: string } = { ok: true, link };
    if (parsed.value.email) {
      const { data: client } = await supabase.from("clients").select("name, owner_name, owner_email").eq("id", parsed.value.clientId).maybeSingle();
      const to = typeof client?.owner_email === "string" ? client.owner_email.trim() : "";
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(to)) body.emailError = "This client has no owner email on file, so nothing was emailed.";
      else if (!onboardingMailReady()) body.emailError = "Email is not switched on yet (SMTP_USER and SMTP_PASSWORD are not set), so nothing was emailed.";
      else {
        try {
          await sendOnboardingEmail({ to, ...agreementEmail({ clientName: String(client?.name ?? ""), ownerName: String(client?.owner_name ?? ""), link }) });
          body.emailedTo = to;
        } catch { body.emailError = "The email could not be sent. Copy the link and send it yourself."; }
      }
    }
    return NextResponse.json(body, { status: 201 });
  });
}
