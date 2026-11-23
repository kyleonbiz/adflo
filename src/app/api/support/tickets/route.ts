import { NextResponse } from "next/server";
import { must, supportFail, supportRoute } from "@/lib/support/api";
import { newActivityEmail, notifyQuietly, supportOrigin, SUPPORT_INBOX } from "@/lib/support/email";
import { parseSupportRequest } from "@/lib/support/validation";

export const dynamic = "force-dynamic";

/** A workspace member opens a support request. */
export function POST(req: Request) {
  return supportRoute(req, async ({ supabase, email }) => {
    const parsed = parseSupportRequest(await req.json().catch(() => null));
    if (!parsed.ok) return supportFail(400, "invalid", "Check the highlighted fields.", parsed.errors);
    const v = parsed.value;
    const id = must(await supabase.rpc("support_create_ticket", { p_subject: v.subject, p_body: v.body, p_category: v.category })) as string;
    const t = must(await supabase.rpc("support_ticket", { p_id: id })) as { ticket_no: number; requester_name: string } | null;
    if (t) {
      await notifyQuietly(SUPPORT_INBOX(), newActivityEmail({ kind: "new", ticketNo: t.ticket_no, subject: v.subject, workspace: "", who: t.requester_name || email, body: v.body, controlUrl: `${supportOrigin(req)}/control/support/${id}` }));
    }
    return NextResponse.json({ ok: true, id }, { status: 201 });
  });
}
