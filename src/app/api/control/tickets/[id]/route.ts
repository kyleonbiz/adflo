import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid, parseTicketPatch } from "@/lib/control/validation";

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
    const { data, error } = await supabase.from("support_tickets").update(patch).eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "23503") return fail(400, "invalid", "That person is not on the team.");
      throw error;
    }
    if (!data) return fail(404, "not_found", "Ticket not found.");
    return NextResponse.json({ ok: true });
  });
}
