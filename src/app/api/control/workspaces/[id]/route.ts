import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid } from "@/lib/control/patterns";
import { workspaceErrorMessage } from "@/lib/control/workspace";
import { purgeWorkspace } from "@/lib/dms/server/purge-workspaces";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Delete a workspace that no client owns, and all its data, now. Owner only. The database function checks the role, the second
 * factor, that no client is linked to it and that its name was typed back, and writes the audit log. The stored files and the
 * workspace are then removed with the same code as the nightly job: if any file cannot be removed nothing is deleted.
 */
export function DELETE(req: Request, ctx: RouteContext<"/api/control/workspaces/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Workspace not found.");
    const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
    const confirm = typeof body?.confirm === "string" ? body.confirm.slice(0, 200) : "";
    const { data, error } = await supabase.rpc("control_check_orphan_workspace_delete", { p_workspace: id, p_confirm: confirm });
    if (error) {
      const e = workspaceErrorMessage(error.code, error.message);
      return fail(e.status, "workspace", e.message);
    }
    const admin = createServiceSupabase();
    if (!admin || typeof data !== "string") return fail(503, "no_service_key", "Deleting needs the server's service key, which is not set. Nothing was deleted.");
    const purged = await purgeWorkspace(admin, data);
    if (!purged.ok) return fail(502, "purge_failed", "Some stored files could not be removed, so nothing was deleted. Try again.");
    return NextResponse.json({ ok: true, filesRemoved: purged.objectsRemoved });
  }, "owner");
}
