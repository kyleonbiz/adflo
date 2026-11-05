import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid, parseNote } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request, ctx: RouteContext<"/api/control/tickets/[id]/notes">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Ticket not found.");
    const parsed = parseNote(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.errors.body);
    const { error } = await supabase.from("ticket_notes").insert({ ticket_id: id, author: staff.userId, body: parsed.value.body });
    if (error) {
      if (error.code === "23503") return fail(404, "not_found", "Ticket not found.");
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
