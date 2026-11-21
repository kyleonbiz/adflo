import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid } from "@/lib/control/patterns";
import { parseNote } from "@/lib/control/validation";
import { replyEmail } from "@/lib/mail/support-email";
import { sendSupportMail } from "@/lib/mail/support";

export const dynamic = "force-dynamic";

export function POST(req: Request, ctx: RouteContext<"/api/control/tickets/[id]/notes">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Ticket not found.");
    const parsed = parseNote(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.errors.body);
    const { body, toClient } = parsed.value;
    const { data: ticket } = await supabase.from("support_tickets").select("subject, source, requester_email").eq("id", id).maybeSingle();
    if (!ticket) return fail(404, "not_found", "Ticket not found.");
    // A reply to the client is only for a request the client opened from inside AdFlo; that is where they read it.
    if (toClient && ticket.source !== "client") return fail(400, "invalid", "Only requests opened by a client can be answered here. Use a note.");
    const { error } = await supabase.from("ticket_notes").insert({ ticket_id: id, author: staff.userId, body, to_client: toClient });
    if (error) {
      if (error.code === "23503") return fail(404, "not_found", "Ticket not found.");
      throw error;
    }
    let emailed: boolean | undefined;
    if (toClient) {
      // Now it is the client's turn.
      await supabase.from("support_tickets").update({ status: "pending" }).eq("id", id).eq("status", "open");
      const to = (ticket.requester_email as string) || "";
      if (to) {
        const mail = replyEmail({ subject: ticket.subject as string, reply: body });
        emailed = await sendSupportMail({ ...mail, to });
      }
    }
    return NextResponse.json({ ok: true, emailed }, { status: 201 });
  });
}
