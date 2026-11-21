import { clientRoute, dbRefusal, refuse, reply } from "@/lib/support/client-route";
import { parseClientRequest } from "@/lib/control/validation";
import { newRequestEmail } from "@/lib/mail/support-email";
import { sendSupportMail } from "@/lib/mail/support";

export const dynamic = "force-dynamic";

/** A signed-in member opens a support request. It lands in the Control center queue, linked to their company. */
export function POST(req: Request) {
  return clientRoute(req, async ({ supabase, user }) => {
    const parsed = parseClientRequest(await req.json().catch(() => null));
    if (!parsed.ok) return refuse(400, "invalid", "Check the highlighted fields.", parsed.errors);
    const v = parsed.value;
    const { data, error } = await supabase.rpc("workspace_submit_ticket", { p_subject: v.subject, p_body: v.body, p_urgent: v.urgent });
    if (error) return dbRefusal(error) ?? Promise.reject(error);
    // Tell the team. The request is already saved, so a mail problem never fails it.
    const { data: ws } = await supabase.from("workspaces").select("name").limit(1).maybeSingle();
    const mail = newRequestEmail({ clientName: (ws?.name as string | undefined) ?? "", requesterEmail: user.email ?? "", subject: v.subject, body: v.body, urgent: v.urgent, ticketId: data as string });
    const emailed = await sendSupportMail({ ...mail, replyTo: user.email ?? undefined });
    return reply(201, { ok: true, id: data, emailed });
  });
}
