import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { isUuid, parseWorkspaceRequest, workspaceErrorMessage } from "@/lib/control/workspace";

export const dynamic = "force-dynamic";

/**
 * Connect a client to its workspace and get the owner in: link an existing workspace, unlink it, create one and invite
 * the owner in one step, or invite the owner again. Each is a database function that checks the role and the second
 * factor itself, writes the audit log and ticks the onboarding step. None of them sends email; the
 * welcome email is a separate action so staff decide when it goes out.
 */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/workspace">) {
  return staffRoute(req, async ({ supabase }) => {
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
    // Nothing is emailed here: the welcome email is its own button (/welcome), so staff choose when it goes out.
    // Only the invite function returns something worth showing: when the invitation runs out.
    return NextResponse.json({ ok: true, expiresAt: req_.action === "invite" && typeof data === "string" ? data : null });
  });
}
