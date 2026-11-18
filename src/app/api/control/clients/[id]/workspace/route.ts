import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { emailWelcome } from "@/lib/control/welcome-email";
import { isUuid, parseWorkspaceRequest, workspaceErrorMessage } from "@/lib/control/workspace";

export const dynamic = "force-dynamic";

/**
 * Connect a client to its workspace and get the owner in: link an existing workspace, unlink it, create one and invite
 * the owner in one step, or invite the owner again. Each is a database function that checks the role and the second
 * factor itself, writes the audit log and ticks the onboarding step. Creating the workspace and renewing the invitation then
 * email the owner the welcome message.
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
    // Creating the workspace or renewing the invitation also emails the owner, so nobody has to remember a second button.
    // If the email cannot go out, the invitation is still saved and the answer says why, so staff can copy the message instead.
    let emailed: string | null = null;
    let emailError: string | null = null;
    if (req_.action === "provision" || req_.action === "invite") {
      const mail = await emailWelcome(supabase, staff.userId, id, req.url);
      if (mail.ok) emailed = mail.emailedTo; else emailError = mail.message;
    }
    // Only the invite function returns something else worth showing: when the invitation runs out.
    return NextResponse.json({ ok: true, expiresAt: req_.action === "invite" && typeof data === "string" ? data : null, emailed, emailError });
  });
}
