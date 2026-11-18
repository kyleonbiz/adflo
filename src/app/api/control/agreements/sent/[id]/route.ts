import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { sentAgreementDeleteError } from "@/lib/control/agreements";
import { isUuid } from "@/lib/control/workspace";

export const dynamic = "force-dynamic";

/** Withdraws an agreement sent to a client that has not been accepted. Its link stops working. An accepted one is kept. */
export function DELETE(req: Request, ctx: RouteContext<"/api/control/agreements/sent/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "That agreement is no longer on this client.");
    const { error } = await supabase.rpc("control_delete_sent_agreement", { p_sent: id });
    if (error) {
      const e = sentAgreementDeleteError(error.code, error.message);
      return fail(e.status, "agreement", e.message);
    }
    return NextResponse.json({ ok: true });
  });
}
