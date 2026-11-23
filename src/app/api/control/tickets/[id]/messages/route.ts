import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid } from "@/lib/control/patterns";
import { notifyQuietly, replyToClientEmail, supportOrigin } from "@/lib/support/email";
import { parseReply } from "@/lib/support/validation";

export const dynamic = "force-dynamic";

/** Staff reply to a client's request. The client sees it in the app and by email; internal notes stay on /notes. */
export function POST(req: Request, ctx: RouteContext<"/api/control/tickets/[id]/messages">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Ticket not found.");
    const parsed = parseReply(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.errors.body);
    const { data: ticket, error: readError } = await supabase.from("support_tickets").select("ticket_no, subject, source, workspace_id, requester_email").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!ticket) return fail(404, "not_found", "Ticket not found.");
    // Replies reach the client through their workspace, so a ticket staff logged for their own use has no one to reply to.
    if (ticket.source !== "client" || !ticket.workspace_id) return fail(409, "internal_ticket", "This ticket was logged by staff and has no client conversation. Add a note instead.");
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: id, author_kind: "staff", author: staff.userId, body: parsed.value.body });
    if (error) throw error;
    await notifyQuietly(ticket.requester_email as string, replyToClientEmail({ ticketNo: ticket.ticket_no as number, subject: ticket.subject as string, staffName: staff.name || "AdFlo Support", body: parsed.value.body, requestUrl: `${supportOrigin(req)}/app/support/${id}` }));
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
