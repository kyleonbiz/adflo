import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { CLIENT_COLUMNS, toClient } from "@/lib/control/data";
import { parseClientInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function PATCH(req: Request, ctx: RouteContext<"/api/control/clients/[id]">) {
  return staffRoute(async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return fail(404, "not_found", "Client not found.");
    const body = await req.json().catch(() => null);
    const parsed = parseClientInput(body, true);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const v = parsed.value;
    const patch: Record<string, unknown> = {};
    if (v.name !== undefined) patch.name = v.name;
    if (v.status !== undefined) patch.status = v.status;
    if (v.plan !== undefined) patch.plan = v.plan;
    if (v.seatsLimit !== undefined) patch.seats_limit = v.seatsLimit;
    if (v.ownerName !== undefined) patch.owner_name = v.ownerName;
    if (v.ownerEmail !== undefined) patch.owner_email = v.ownerEmail;
    if (v.notes !== undefined) patch.notes = v.notes;
    if (!Object.keys(patch).length) return fail(400, "empty", "Nothing to change.");
    const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select(CLIENT_COLUMNS).maybeSingle();
    if (error) {
      if (error.code === "23505") return fail(409, "duplicate", "A client with that name already exists.");
      throw error;
    }
    if (!data) return fail(404, "not_found", "Client not found.");
    return NextResponse.json({ ok: true, client: toClient(data) });
  });
}
