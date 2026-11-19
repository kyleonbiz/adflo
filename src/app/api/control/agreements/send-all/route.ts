import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/site-url";
import { fail, staffRoute } from "@/lib/control/api";
import { hashToken, newToken } from "@/lib/control/token";
import { parseSendAllInput } from "@/lib/control/validation";
import { agreementsEmail } from "@/lib/mail/onboarding-email";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { SENDABLE_EMAIL } from "@/lib/control/patterns";

export const dynamic = "force-dynamic";

/**
 * Creates one acceptance link per agreement (for example Terms and Privacy Policy) for one client and, with `email: true`,
 * sends them together in a single email from the onboarding@ alias. Links are returned once and only their hashes are stored.
 * If the email fails the links are still returned so staff can send them by hand.
 */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase }) => {
    const parsed = parseSendAllInput(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.errors.templateIds);
    const { clientId, templateIds, email } = parsed.value;
    const { data: templates } = await supabase.from("agreement_templates").select("id, title").in("id", templateIds);
    if (!templates || templates.length !== templateIds.length) return fail(404, "not_found", "Client or agreement not found.");
    const titleOf = new Map(templates.map((t) => [String(t.id), String(t.title)]));
    const origin = siteOrigin(req.url);
    const items: { id: string; title: string; link: string }[] = [];
    for (const id of templateIds) {
      const token = newToken();
      const { error } = await supabase.rpc("control_send_agreement", { p_client: clientId, p_template: id, p_token_hash: hashToken(token) });
      if (error) {
        if (error.code === "23503") return fail(404, "not_found", "Client or agreement not found.");
        throw error;
      }
      items.push({ id, title: titleOf.get(id) ?? "Agreement", link: `${origin}/agreement/${token}` });
    }
    const body: { ok: true; items: typeof items; emailedTo?: string; emailError?: string } = { ok: true, items };
    if (email) {
      const { data: client } = await supabase.from("clients").select("name, owner_name, owner_email").eq("id", clientId).maybeSingle();
      const to = typeof client?.owner_email === "string" ? client.owner_email.trim() : "";
      if (!SENDABLE_EMAIL.test(to)) body.emailError = "This client has no owner email on file, so nothing was emailed.";
      else if (!onboardingMailReady()) body.emailError = "Email is not switched on yet (SMTP_USER and SMTP_PASSWORD are not set), so nothing was emailed.";
      else {
        try {
          await sendOnboardingEmail({ to, ...agreementsEmail({ clientName: String(client?.name ?? ""), ownerName: String(client?.owner_name ?? ""), items }) });
          body.emailedTo = to;
        } catch { body.emailError = "The email could not be sent. Copy the links and send them yourself."; }
      }
    }
    return NextResponse.json(body, { status: 201 });
  });
}
