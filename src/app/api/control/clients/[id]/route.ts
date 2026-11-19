import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { clientDeleteError } from "@/lib/control/client-delete";
import { CLIENT_COLUMNS, toClient } from "@/lib/control/data";
import { findDuplicateClient } from "@/lib/control/duplicates";
import { purgeWorkspace } from "@/lib/dms/server/purge-workspaces";
import { createServiceSupabase } from "@/lib/supabase/server";
import { parseClientInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function PATCH(req: Request, ctx: RouteContext<"/api/control/clients/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
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
    if (v.priceOverrideCents !== undefined) patch.price_override_cents = v.priceOverrideCents;
    if (v.priceNote !== undefined) patch.price_note = v.priceNote;
    if (!Object.keys(patch).length) return fail(400, "empty", "Nothing to change.");
    if (v.name !== undefined || v.ownerEmail) {
      const { data: existing } = await supabase.from("clients").select("id, name, owner_email");
      const dup = findDuplicateClient(existing ?? [], { name: v.name, ownerEmail: v.ownerEmail }, id);
      if (dup) return NextResponse.json({ ok: false, error: { code: "duplicate", message: dup.message, fields: { [dup.field]: dup.message } } }, { status: 409 });
    }
    const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select(CLIENT_COLUMNS).maybeSingle();
    if (error) {
      if (error.code === "42501") return fail(403, "owner_only", "Only the Owner can set a client's own price.");
      if (error.code === "23505") return fail(409, "duplicate", "A client with that name or owner email already exists.");
      throw error;
    }
    if (!data) return fail(404, "not_found", "Client not found.");
    return NextResponse.json({ ok: true, client: toClient(data) });
  });
}

/**
 * Owner deletes a client together with its workspace, in one step. The database function checks the role, the second factor, that
 * the name was typed back, that the client is not active and has not accepted an agreement, and writes the audit log. If the
 * client has a workspace its stored files and the workspace are erased first, with the same code as the nightly job: if any file
 * cannot be removed nothing is deleted. Only then is the client record removed, so a client and its workspace never part ways.
 */
export function DELETE(req: Request, ctx: RouteContext<"/api/control/clients/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return fail(404, "not_found", "That client no longer exists.");
    const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
    const confirm = typeof body?.confirm === "string" ? body.confirm.slice(0, 200) : "";
    const check = await supabase.rpc("control_check_client_delete", { p_client: id, p_confirm: confirm });
    if (check.error) {
      const e = clientDeleteError(check.error.code, check.error.message);
      return fail(e.status, "client", e.message);
    }
    let filesRemoved = 0;
    if (typeof check.data === "string") {
      const admin = createServiceSupabase();
      if (!admin) return fail(503, "no_service_key", "Deleting needs the server's service key, which is not set. Nothing was deleted.");
      const purged = await purgeWorkspace(admin, check.data);
      if (!purged.ok) return fail(502, "purge_failed", "Some stored files could not be removed, so nothing was deleted. Try again.");
      filesRemoved = purged.objectsRemoved;
    }
    const { error } = await supabase.rpc("control_delete_client", { p_client: id });
    if (error) {
      const e = clientDeleteError(error.code, error.message);
      return fail(e.status, "client", e.message);
    }
    return NextResponse.json({ ok: true, filesRemoved });
  }, "owner");
}
