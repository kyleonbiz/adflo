import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { emailInvitation } from "@/lib/control/invitation-email";
import { isUuid } from "@/lib/control/workspace";

export const dynamic = "force-dynamic";

/** Emails the owner their invitation again, with a fresh confirm link (the earlier one stops working). */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/invitation">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
    const result = await emailInvitation(supabase, id, req.url);
    if (!result.ok) return fail(result.status, result.code, result.message);
    return NextResponse.json({ ok: true, emailedTo: result.emailedTo });
  });
}
