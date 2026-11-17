import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/site-url";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid, welcomeEmailSubject, welcomeMessage } from "@/lib/control/workspace";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";

export const dynamic = "force-dynamic";
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/**
 * Emails the welcome message to the client's owner from the onboarding@ alias and ticks the "Welcome message sent" step.
 * The step is only ticked when the email really went out. (The same text can still be copied and sent by hand.)
 */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/welcome">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
    const { data: client } = await supabase.from("clients").select("name, owner_name, owner_email, workspace_id").eq("id", id).maybeSingle();
    if (!client) return fail(404, "not_found", "Client not found.");
    const to = typeof client.owner_email === "string" ? client.owner_email.trim() : "";
    if (!EMAIL.test(to)) return fail(409, "no_owner_email", "Add the owner's email to the client first (Edit).");
    if (!client.workspace_id) return fail(409, "no_workspace", "Create or connect the workspace first, so the owner has somewhere to land.");
    if (!onboardingMailReady()) return fail(503, "mail_off", "Email is not switched on yet (SMTP_USER and SMTP_PASSWORD are not set). Use Copy welcome message instead.");
    const text = welcomeMessage({ clientName: String(client.name ?? ""), ownerName: String(client.owner_name ?? ""), ownerEmail: to, signupUrl: `${siteOrigin(req.url)}/signup` });
    try {
      await sendOnboardingEmail({ to, subject: welcomeEmailSubject(String(client.name ?? "")), text });
    } catch {
      return fail(502, "mail_failed", "The email could not be sent. Use Copy welcome message and send it yourself.");
    }
    const { error } = await supabase.from("client_checklist").upsert({ client_id: id, step: "welcome_sent", done_by: staff.userId }, { onConflict: "client_id,step", ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, emailedTo: to });
  });
}
