import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { parseChecklistInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Tick or untick one onboarding step for a client. */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/checklist">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return fail(404, "not_found", "Client not found.");
    const parsed = parseChecklistInput(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", "Unknown step.");
    const { step, done } = parsed.value;
    const { error } = done
      ? await supabase.from("client_checklist").upsert({ client_id: id, step, done_by: staff.userId }, { onConflict: "client_id,step", ignoreDuplicates: true })
      : await supabase.from("client_checklist").delete().eq("client_id", id).eq("step", step);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  });
}
