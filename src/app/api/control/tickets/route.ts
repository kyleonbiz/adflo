import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/control/api";
import { parseTicketInput } from "@/lib/control/validation";
import { sharedWithClientEmail, notifyQuietly, supportOrigin } from "@/lib/support/email";
import { NO_WORKSPACE, shareTarget, STAFF_REQUESTER } from "@/lib/support/sharing";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const parsed = parseTicketInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const v = parsed.value;
    // Sharing links the ticket to the client's workspace, which is what lets that client see it.
    const target = v.share && v.clientId ? await shareTarget(supabase, v.clientId) : null;
    if (v.share && !target) return NextResponse.json({ ok: false, error: { code: "no_workspace", message: NO_WORKSPACE, fields: { clientId: NO_WORKSPACE } } }, { status: 400 });
    const { data, error } = await supabase.from("support_tickets").insert({
      subject: v.subject, body: v.body, client_id: v.clientId, priority: v.priority, category: v.category, created_by: staff.userId,
      ...(target ? { workspace_id: target.workspaceId, requester_name: STAFF_REQUESTER, requester_email: target.ownerEmail } : {}),
    }).select("id, ticket_no").single();
    if (error) throw error;
    if (target) await notifyQuietly(target.ownerEmail, sharedWithClientEmail({ ticketNo: data.ticket_no as number, subject: v.subject, body: v.body, requestUrl: `${supportOrigin(req)}/app/support/${data.id}` }));
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  });
}

