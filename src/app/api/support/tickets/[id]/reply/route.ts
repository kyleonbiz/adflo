import { clientRoute, dbRefusal, refuse, reply } from "@/lib/support/client-route";
import { isUuid } from "@/lib/control/patterns";
import { parseClientReply } from "@/lib/control/validation";
import { sendSupportMail } from "@/lib/mail/support";

export const dynamic = "force-dynamic";

/** The client answers back on one of their own requests. It reopens the request, so it shows as open in the queue again. */
export function POST(req: Request, ctx: RouteContext<"/api/support/tickets/[id]/reply">) {
  return clientRoute(req, async ({ supabase, user }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "not_found", "Request not found.");
    const parsed = parseClientReply(await req.json().catch(() => null));
    if (!parsed.ok) return refuse(400, "invalid", parsed.errors.body);
    const { error } = await supabase.rpc("workspace_ticket_reply", { p_ticket: id, p_body: parsed.value.body });
    if (error) return dbRefusal(error) ?? Promise.reject(error);
    await sendSupportMail({ subject: "Support reply from a client", replyTo: user.email ?? undefined, text: `${user.email ?? "A client"} replied on a support request:\n\n${parsed.value.body}\n\nhttps://www.adflo.pro/control/support` });
    return reply(201, { ok: true });
  });
}
