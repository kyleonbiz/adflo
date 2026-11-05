import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { parsePlanInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function PATCH(req: Request, ctx: RouteContext<"/api/control/plans/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return fail(404, "not_found", "Plan not found.");
    const parsed = parsePlanInput(await req.json().catch(() => null), true);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const v = parsed.value;
    const patch: Record<string, unknown> = {};
    if (v.name !== undefined) patch.name = v.name;
    if (v.priceCents !== undefined) patch.price_cents = v.priceCents;
    if (v.seatsIncluded !== undefined) patch.seats_included = v.seatsIncluded;
    if (v.active !== undefined) patch.active = v.active;
    if (v.features !== undefined) patch.features = v.features;
    if (!Object.keys(patch).length) return fail(400, "empty", "Nothing to change.");
    const { data, error } = await supabase.from("plans").update(patch).eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "23505") return fail(409, "duplicate", "A plan with that name already exists.");
      throw error;
    }
    if (!data) return fail(404, "not_found", "Plan not found.");
    return NextResponse.json({ ok: true });
  }, "owner");
}
