import { DmsError } from "@/lib/dms/errors";
import { SHARE_CREATE_RATE, SHARE_EMAIL_RATE, checkRate } from "@/lib/dms/server/rate-limit";
import { readJson, route } from "@/lib/dms/server/respond";
import { shareLinkSchema, uuid } from "@/lib/dms/validation";
import { getServiceRoleKey } from "@/lib/supabase/env";
import { onboardingMailReady, sendMail } from "@/lib/mail/onboarding";
import { shareEmail, shareFromHeader } from "@/lib/mail/share-email";
import { siteOrigin } from "@/lib/site-url";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/dms/documents/[id]/share">) {
  const { id } = await ctx.params;
  return route(req, async ({ service, mode }) => {
    // Without the service-role key links cannot be used, so none are offered.
    if (mode !== "live" || !getServiceRoleKey()) return [];
    return service.listShareLinks(uuid.parse(id));
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/dms/documents/[id]/share">) {
  const { id } = await ctx.params;
  const body = await readJson(req);
  const origin = siteOrigin(req.url);
  return route(req, async ({ service, mode, userId }) => {
    if (mode !== "live" || !getServiceRoleKey()) {
      throw new DmsError("unavailable", "Share links need Supabase with SUPABASE_SERVICE_ROLE_KEY configured.");
    }
    const { ttlMinutes, emailTo, message } = shareLinkSchema.parse(body);
    const docId = uuid.parse(id);
    // Checked before the link is made, so a refused email never leaves an unused link behind.
    if (emailTo) {
      if (!onboardingMailReady()) throw new DmsError("unavailable", "Email is not switched on yet. Leave the address empty and copy the link instead.");
      if (!checkRate(userId, SHARE_EMAIL_RATE).ok) throw new DmsError("rate_limited", "You have emailed a lot of links in the last hour. Try again later, or copy the link instead.");
    }
    const { token, expiresAt } = await service.createShareLink(docId, ttlMinutes);
    const url = `${origin}/share/${token}`;
    const result: { url: string; expiresAt: string; emailedTo?: string; emailError?: string } = { url, expiresAt };
    if (emailTo) {
      try {
        const doc = await service.getDocument(docId);
        const { data } = await (await createServerSupabase()).auth.getUser();
        const senderName = (data.user?.user_metadata?.full_name as string | undefined) || data.user?.email?.split("@")[0] || "";
        const expiresAtLabel = new Date(expiresAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
        const mail = shareEmail({ senderName, fileName: doc.displayName, url, expiresAtLabel, message });
        await sendMail({ from: shareFromHeader(senderName), replyTo: data.user?.email ?? undefined, to: emailTo, subject: mail.subject, text: mail.text });
        result.emailedTo = emailTo;
      } catch {
        result.emailError = "The link was created but the email could not be sent. Copy the link and send it yourself.";
      }
    }
    return result;
  }, { rate: SHARE_CREATE_RATE });
}
