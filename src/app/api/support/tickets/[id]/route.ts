import { NextResponse } from "next/server";
import { isUuid } from "@/lib/control/patterns";
import { must, supportFail, supportRoute } from "@/lib/support/api";
import { parseClosed } from "@/lib/support/validation";

export const dynamic = "force-dynamic";

/** Close a request ("sorted, thanks") or reopen it. */
export function PATCH(req: Request, ctx: RouteContext<"/api/support/tickets/[id]">) {
  return supportRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return supportFail(404, "not_found", "Request not found.");
    const parsed = parseClosed(await req.json().catch(() => null));
    if (!parsed.ok) return supportFail(400, "invalid", parsed.errors.closed);
    must(await supabase.rpc("support_set_closed", { p_id: id, p_closed: parsed.value.closed }));
    return NextResponse.json({ ok: true });
  });
}
