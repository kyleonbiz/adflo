import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";

export const dynamic = "force-dynamic";

/** Mark an error handled (or reopen it). */
export function PATCH(req: Request, ctx: RouteContext<"/api/control/errors/[id]">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!/^\d{1,15}$/.test(id)) return fail(404, "not_found", "Error not found.");
    const body = (await req.json().catch(() => null)) as { resolved?: unknown } | null;
    if (typeof body?.resolved !== "boolean") return fail(400, "invalid", "Say whether it is resolved.");
    const { data, error } = await supabase.from("app_errors").update(body.resolved ? { resolved_at: new Date().toISOString(), resolved_by: staff.userId } : { resolved_at: null, resolved_by: staff.userId }).eq("id", Number(id)).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return fail(404, "not_found", "Error not found.");
    return NextResponse.json({ ok: true });
  });
}
