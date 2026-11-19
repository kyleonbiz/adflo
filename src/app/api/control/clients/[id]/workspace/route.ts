import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid, parseWorkspaceRequest, workspaceErrorMessage } from "@/lib/control/workspace";
import { emailWelcome } from "@/lib/control/welcome-email";
import { purgeWorkspace } from "@/lib/dms/server/purge-workspaces";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Connect a client to its workspace and get the owner in: link an existing workspace, unlink it, create one and invite
 * the owner in one step, or invite the owner again. Each is a database function that checks the role and the second
 * factor itself, writes the audit log and ticks the onboarding step. Creating the workspace and inviting the owner then
 * email the owner their invitation (a confirm link) at once. If that email cannot go out the invitation is still saved
 * and the answer says why, so staff can use "Copy welcome message" instead.
 */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/workspace">) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
    const req_ = parseWorkspaceRequest(await req.json().catch(() => null));
    if (!req_.ok) return fail(400, "invalid", req_.message);

    const call =
      req_.action === "link" ? supabase.rpc("control_link_workspace", { p_client: id, p_workspace: req_.workspaceId })
      : req_.action === "unlink" ? supabase.rpc("control_unlink_workspace", { p_client: id })
      : req_.action === "provision" ? supabase.rpc("control_provision_workspace", { p_client: id })
      : supabase.rpc("control_invite_owner", { p_client: id });
    const { data, error } = await call;
    if (error) {
      const e = workspaceErrorMessage(error.code, error.message);
      return fail(e.status, "workspace", e.message);
    }
    // The invitation exists now, so the owner is told straight away. A failed email never undoes the invitation.
    let mail: { emailedTo?: string; emailError?: string } = {};
    if (req_.action === "provision" || req_.action === "invite") {
      try {
        const r = await emailWelcome(supabase, staff.userId, id, req.url);
        mail = r.ok ? { emailedTo: r.emailedTo } : { emailError: r.message };
      } catch { mail = { emailError: "The invitation email could not be sent. Use Copy welcome message and send it yourself." }; }
    }
    // Only the invite function returns something worth showing: when the invitation runs out.
    return NextResponse.json({ ok: true, expiresAt: req_.action === "invite" && typeof data === "string" ? data : null, ...mail });
  });
}

/**
 * Delete a cancelled client's workspace and all its data now. Owner only. The database function checks the role, the second
 * factor, that the client is cancelled and that its name was typed back, and writes the audit log. The stored files and the
 * workspace are then removed with the same code as the nightly job: if any file cannot be removed nothing is deleted.
 * The client record stays; deleting it is a separate button.
 */
export function DELETE(req: Request, ctx: RouteContext<"/api/control/clients/[id]/workspace">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
    const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
    const confirm = typeof body?.confirm === "string" ? body.confirm.slice(0, 200) : "";
    const { data, error } = await supabase.rpc("control_check_workspace_delete", { p_client: id, p_confirm: confirm });
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
