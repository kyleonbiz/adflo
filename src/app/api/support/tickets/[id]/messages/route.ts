import { NextResponse } from "next/server";
import { isUuid } from "@/lib/control/patterns";
import { must, supportFail, supportRoute } from "@/lib/support/api";
import { newActivityEmail, notifyQuietly, supportOrigin, SUPPORT_INBOX } from "@/lib/support/email";
import { parseReply } from "@/lib/support/validation";

export const dynamic = "force-dynamic";

/** A client replies on their own request. */
export function POST(req: Request, ctx: RouteContext<"/api/support/tickets/[id]/messages">) {
  return supportRoute(req, async ({ supabase, email }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return supportFail(404, "not_found", "Request not found.");
    const parsed = parseReply(await req.json().catch(() => null));
    if (!parsed.ok) return supportFail(400, "invalid", parsed.errors.body, parsed.errors);
    must(await supabase.rpc("support_reply", { p_id: id, p_body: parsed.value.body }));
    const t = must(await supabase.rpc("support_ticket", { p_id: id })) as { ticket_no: number; subject: string; requester_name: string } | null;
    if (t) await notifyQuietly(SUPPORT_INBOX(), newActivityEmail({ kind: "reply", ticketNo: t.ticket_no, subject: t.subject, workspace: "", who: email, body: parsed.value.body, controlUrl: `${supportOrigin(req)}/control/support/${id}` }));
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
