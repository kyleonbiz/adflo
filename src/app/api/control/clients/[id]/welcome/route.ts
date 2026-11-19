import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { emailWelcome } from "@/lib/control/welcome-email";
import { isUuid } from "@/lib/control/patterns";

export const dynamic = "force-dynamic";

/** Emails the welcome message to the client's owner and ticks "Welcome message sent" (only if the email went out). */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/welcome">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
    const result = await emailWelcome(supabase, staff.userId, id, req.url);
    if (!result.ok) return fail(result.status, result.code, result.message);
    return NextResponse.json({ ok: true, emailedTo: result.emailedTo });
  });
}
