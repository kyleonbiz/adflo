import { DmsError } from "@/lib/dms/errors";
import { DELETION_GRACE_DAYS, deletionDate, deletionDaysLeft, type DeletionStatus } from "@/lib/dms/deletion";
import { findMembership, type Dms } from "@/lib/dms/server/context";
import { readJson, route } from "@/lib/dms/server/respond";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STRICT = { name: "workspace-deletion", max: 5, windowMs: 60 * 60_000 };

async function context(dms: Dms) {
  if (dms.mode !== "live") throw new DmsError("unavailable", "Closing a workspace needs a connected workspace.");
  const db = await createServerSupabase();
  const m = await findMembership(db, dms.userId);
  if (!m) throw new DmsError("not_found", "You do not belong to a workspace yet.");
  return { db, workspaceId: m.workspaceId, role: m.role };
}

async function status(db: Awaited<ReturnType<typeof createServerSupabase>>, workspaceId: string): Promise<DeletionStatus> {
  const { data } = await db.from("workspaces").select("deletion_requested_at").eq("id", workspaceId).maybeSingle();
  const at = (data?.deletion_requested_at as string | null | undefined) ?? null;
  return at
    ? { scheduledFor: deletionDate(at), daysLeft: deletionDaysLeft(at), graceDays: DELETION_GRACE_DAYS }
    : { scheduledFor: null, daysLeft: 0, graceDays: DELETION_GRACE_DAYS };
}

/** Whether this workspace is scheduled to be erased, and when. Any member may ask. */
export const GET = (req: Request) => route(req, async (dms) => {
  const { db, workspaceId } = await context(dms);
  return status(db, workspaceId);
});

/** Starts the 30-day countdown. Owner only; the body is `{ confirmName }`, the workspace name typed in full. */
export const POST = (req: Request) => route(req, async (dms) => {
  const { db, workspaceId, role } = await context(dms);
  if (role !== "owner") throw new DmsError("forbidden", "Only the owner can close this workspace.");
  const body = (await readJson(req)) as { confirmName?: unknown };
  const confirm = typeof body.confirmName === "string" ? body.confirmName : "";
  if (!confirm.trim()) throw new DmsError("validation", "Type the workspace name to confirm.");
  const { error } = await db.rpc("workspace_request_deletion", { p_workspace: workspaceId, p_confirm: confirm });
  if (error) {
    if (error.code === "22023") throw new DmsError("validation", "The name you typed does not match.");
    if (error.code === "42501") throw new DmsError("forbidden", "Only the owner can close this workspace.");
    throw new DmsError("internal", "Could not close the workspace.");
  }
  return status(db, workspaceId);
}, { rate: STRICT });

/** Cancels the countdown; the workspace carries on as it was. Owner only. */
export const DELETE = (req: Request) => route(req, async (dms) => {
  const { db, workspaceId, role } = await context(dms);
  if (role !== "owner") throw new DmsError("forbidden", "Only the owner can cancel this.");
  const { error } = await db.rpc("workspace_cancel_deletion", { p_workspace: workspaceId });
  if (error) throw new DmsError("internal", "Could not cancel.");
  return status(db, workspaceId);
}, { rate: STRICT });
