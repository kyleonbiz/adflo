import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { STAFF_ROLES, type StaffRole } from "@/lib/control/types";
import { isUuid } from "@/lib/control/patterns";

export const dynamic = "force-dynamic";

/** Owner changes a teammate's role or switches their access off and on. */
export function PATCH(req: Request, ctx: RouteContext<"/api/control/staff/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Person not found.");
    const body = (await req.json().catch(() => null)) as { role?: unknown; active?: unknown } | null;
    const patch: { role?: StaffRole; active?: boolean } = {};
    if (body?.role !== undefined) { if (!STAFF_ROLES.includes(body.role as StaffRole)) return fail(400, "invalid", "Choose Owner, Support or Billing."); patch.role = body.role as StaffRole; }
    if (body?.active !== undefined) { if (typeof body.active !== "boolean") return fail(400, "invalid", "Active must be on or off."); patch.active = body.active; }
    if (!Object.keys(patch).length) return fail(400, "empty", "Nothing to change.");
    const { data, error } = await supabase.from("staff_members").update(patch).eq("user_id", id).select("user_id").maybeSingle();
    if (error) {
      if (error.code === "23514") return fail(409, "last_owner", "There must always be one active Owner.");
      throw error;
    }
    if (!data) return fail(404, "not_found", "Person not found.");
    return NextResponse.json({ ok: true });
  }, "owner");
}
