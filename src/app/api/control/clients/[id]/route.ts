import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { clientDeleteError } from "@/lib/control/client-delete";
import { CLIENT_COLUMNS, toClient } from "@/lib/control/data";
import { findDuplicateClient } from "@/lib/control/duplicates";
import { purgeWorkspace } from "@/lib/dms/server/purge-workspaces";
import { createServiceSupabase } from "@/lib/supabase/server";
import { parseClientInput } from "@/lib/control/validation";
import { isUuid } from "@/lib/control/patterns";

export const dynamic = "force-dynamic";


export function PATCH(req: Request, ctx: RouteContext<"/api/control/clients/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
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
 * the name was typed back, that the client is not active and, when it has signed agreements, that the Owner acknowledged they are deleted too (a copy goes into the audit log), and writes the audit log. If the
 * client has a workspace its stored files and the workspace are erased first, with the same code as the nightly job: if any file
 * cannot be removed nothing is deleted. Then the client record is removed, so a client and its workspace never part ways, and last the sign-in accounts of its members and owner (never staff, never anyone who also belongs to another client's workspace).
 */
export function DELETE(req: Request, ctx: RouteContext<"/api/control/clients/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "That client no longer exists.");
    const body = (await req.json().catch(() => null)) as { confirm?: unknown; acknowledgeAgreements?: unknown } | null;
    const confirm = typeof body?.confirm === "string" ? body.confirm.slice(0, 200) : "";
    const check = await supabase.rpc("control_check_client_delete", { p_client: id, p_confirm: confirm, p_ack: body?.acknowledgeAgreements === true });
    if (check.error) {
      const e = clientDeleteError(check.error.code, check.error.message);
      // The client has signed agreements: the page then asks for the extra acknowledgement.
      return fail(e.status, check.error.hint === "needs_ack" ? "needs_ack" : "client", e.message);
    }
    let filesRemoved = 0;
    // Everything of theirs goes: the workspace's members and the owner's sign-in too, unless they belong to another client or are staff.
    // The list is read now, before the workspace (and with it the membership rows) is erased.
    const admin = createServiceSupabase();
    const accounts = await supabase.rpc("control_client_account_ids", { p_client: id });
    const doomed = ((accounts.data ?? []) as { user_id: string; email: string; other_workspaces: number | string }[]).filter((a) => Number(a.other_workspaces) === 0);
    if (doomed.length && !admin) return fail(503, "no_service_key", "Deleting needs the server's service key, which is not set. Nothing was deleted.");
    if (typeof check.data === "string") {
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
    // The client and its workspace are gone; now their sign-in accounts. A failure here does not undo the delete: it is reported.
    let accountsRemoved = 0;
    const removed: string[] = [];
    for (const a of doomed) {
      const rm = await admin!.auth.admin.deleteUser(a.user_id);
      if (!rm.error) { accountsRemoved++; removed.push(a.email); }
    }
    if (removed.length) await supabase.rpc("control_log", { p_action: "client.accounts_removed", p_entity: "client", p_entity_id: id, p_detail: { client_id: id, emails: removed } });
    return NextResponse.json({ ok: true, filesRemoved, accountsRemoved, accountsFailed: doomed.length - accountsRemoved });
  }, "owner");
}
