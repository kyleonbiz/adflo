import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { cooldownHoursLeft, isReminderKind } from "@/lib/control/reminders";
import { hashToken, newToken } from "@/lib/control/token";
import { isUuid, welcomeEmailSubject, welcomeMessage } from "@/lib/control/workspace";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { agreementsEmail } from "@/lib/mail/onboarding-email";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/**
 * Emails the client's owner a reminder from the onboarding@ alias: "signup" repeats the welcome message (their account is
 * waiting), "agreement" sends fresh links for every agreement still waiting (old unaccepted links are withdrawn, so only the
 * new ones work). One reminder per client per day; each one is logged so the tracker can show when it last went out.
 */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/remind">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
    const body = (await req.json().catch(() => null)) as { kind?: unknown } | null;
    if (!isReminderKind(body?.kind)) return fail(400, "invalid", "Choose what to remind them about.");
    const kind = body.kind;

    const { data: client } = await supabase.from("clients").select("name, owner_name, owner_email, workspace_id").eq("id", id).maybeSingle();
    if (!client) return fail(404, "not_found", "Client not found.");
    const to = typeof client.owner_email === "string" ? client.owner_email.trim() : "";
    if (!EMAIL.test(to)) return fail(409, "no_owner_email", "Add the owner's email to the client first (Edit).");
    if (!onboardingMailReady()) return fail(503, "mail_off", "Email is not switched on yet (SMTP_USER and SMTP_PASSWORD are not set).");

    const { data: last } = await supabase.from("client_reminders").select("sent_at").eq("client_id", id).order("sent_at", { ascending: false }).limit(1).maybeSingle();
    const wait = cooldownHoursLeft(last?.sent_at as string | undefined);
    if (wait > 0) return fail(429, "too_soon", `They were reminded in the last day. You can remind them again in about ${wait} ${wait === 1 ? "hour" : "hours"}.`);

    const clientName = String(client.name ?? "");
    const ownerName = String(client.owner_name ?? "");
    const origin = siteOrigin(req.url);

    if (kind === "signup") {
      if (!client.workspace_id) return fail(409, "no_workspace", "Create or connect the workspace first, so the owner has somewhere to land.");
      const text = `A friendly reminder: your AdFlo account is ready and waiting for you.\n\n${welcomeMessage({ clientName, ownerName, ownerEmail: to, signupUrl: `${origin}/signup` })}`;
      try { await sendOnboardingEmail({ to, subject: `Reminder: ${welcomeEmailSubject(clientName)}`, text }); }
      catch { return fail(502, "mail_failed", "The email could not be sent. Try again in a moment."); }
    } else {
      const { data: waiting } = await supabase.from("agreements_sent").select("id, template_id").eq("client_id", id).is("accepted_at", null);
      const rows = (waiting ?? []) as { id: string; template_id: string }[];
      if (rows.length === 0) return fail(409, "nothing_waiting", "Nothing is waiting for them to accept.");
      const templateIds = [...new Set(rows.map((r) => r.template_id))];
      const { data: templates } = await supabase.from("agreement_templates").select("id, title").in("id", templateIds);
      const titleOf = new Map((templates ?? []).map((t) => [String(t.id), String(t.title)]));
      const items: { title: string; link: string }[] = [];
      for (const templateId of templateIds) {
        const token = newToken();
        const { error } = await supabase.rpc("control_send_agreement", { p_client: id, p_template: templateId, p_token_hash: hashToken(token) });
        if (error) throw error;
        items.push({ title: titleOf.get(templateId) ?? "Agreement", link: `${origin}/agreement/${token}` });
      }
      try { await sendOnboardingEmail({ to, ...agreementsEmail({ clientName, ownerName, items, reminder: true }) }); }
      catch { return fail(502, "mail_failed", "New links were made but the email could not be sent. Open the client and use Create link and email it."); }
      // The fresh links are out; withdraw the old unaccepted ones so only the new ones work.
      for (const r of rows) await supabase.rpc("control_delete_sent_agreement", { p_sent: r.id });
    }
    await supabase.rpc("control_log_reminder", { p_client: id, p_kind: kind });
    return NextResponse.json({ ok: true, kind, emailedTo: to });
  });
}
