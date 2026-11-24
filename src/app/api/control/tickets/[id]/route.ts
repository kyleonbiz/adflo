import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid } from "@/lib/control/patterns";
import { parseTicketPatch } from "@/lib/control/validation";
import { notifyQuietly, sharedWithClientEmail, supportOrigin } from "@/lib/support/email";
import { NO_WORKSPACE, shareTarget, STAFF_REQUESTER } from "@/lib/support/sharing";

export const dynamic = "force-dynamic";

export function PATCH(req: Request, ctx: RouteContext<"/api/control/tickets/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Ticket not found.");
    const parsed = parseTicketPatch(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: Object.values(parsed.errors)[0], fields: parsed.errors } }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (parsed.value.status !== undefined) patch.status = parsed.value.status;
    if (parsed.value.priority !== undefined) patch.priority = parsed.value.priority;
    if (parsed.value.assignee !== undefined) patch.assignee = parsed.value.assignee;

    // Sharing links the ticket to the client's workspace; unsharing takes the link away. The conversation is kept either way.
    let announce: { ticketNo: number; subject: string; body: string; to: string } | null = null;
    if (parsed.value.shared !== undefined) {
      const { data: t, error: readError } = await supabase.from("support_tickets").select("ticket_no, subject, body, client_id, source, workspace_id, requester_email").eq("id", id).maybeSingle();
      if (readError) throw readError;
      if (!t) return fail(404, "not_found", "Ticket not found.");
      if (parsed.value.shared) {
        if (!t.client_id) return fail(400, "no_client", "This ticket has no client, so there is nobody to share it with.");
        const target = await shareTarget(supabase, t.client_id as string);
        if (!target) return fail(400, "no_workspace", NO_WORKSPACE);
        if (!t.workspace_id) {
          patch.workspace_id = target.workspaceId;
          if (t.source === "staff") { patch.requester_name = STAFF_REQUESTER; if (!t.requester_email) patch.requester_email = target.ownerEmail; }
          announce = { ticketNo: t.ticket_no as number, subject: t.subject as string, body: t.body as string, to: (t.requester_email as string) || target.ownerEmail };
        }
      } else if (t.source === "client") {
        return fail(409, "client_request", "This request came from the client, so it stays visible to them.");
      } else {
        patch.workspace_id = null;
      }
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

    const { data, error } = await supabase.from("support_tickets").update(patch).eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "23503") return fail(400, "invalid", "That person is not on the team.");
      throw error;
    }
    if (!data) return fail(404, "not_found", "Ticket not found.");
    if (announce) await notifyQuietly(announce.to, sharedWithClientEmail({ ticketNo: announce.ticketNo, subject: announce.subject, body: announce.body, requestUrl: `${supportOrigin(req)}/app/support/${id}` }));
    return NextResponse.json({ ok: true });
  });
}
