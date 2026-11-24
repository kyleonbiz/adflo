import { DmsError, toDmsError } from "@/lib/dms/errors";
import { findMembership, getDms } from "@/lib/dms/server/context";
import { json, sameOrigin } from "@/lib/dms/server/respond";
import { hashToken, newToken } from "@/lib/control/token";
import { siteOrigin } from "@/lib/site-url";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const fail = (code: string, message: string, status: number) => json({ ok: false, error: { code, message } }, status);
const statusOf = (code: string) => (code === "unauthenticated" ? 401 : code === "forbidden" ? 403 : code === "not_found" ? 404 : code === "unavailable" ? 503 : 500);

async function context() {
  const dms = await getDms();
  if (dms.mode !== "live") throw new DmsError("unavailable", "The calendar link needs a connected workspace.");
  const db = await createServerSupabase();
  const membership = await findMembership(db, dms.userId);
  if (!membership) throw new DmsError("not_found", "You do not belong to a workspace yet.");
  return { db, membership };
}

/** Is there a private calendar link for this workspace, and since when? Any member can ask. Never returns the link itself. */
export async function GET() {
  try {
    const { db, membership } = await context();
    const { data, error } = await db.rpc("calendar_feed_info", { p_workspace: membership.workspaceId });
    if (error) throw new DmsError("internal", "Could not check the calendar link.");
    return json({ ok: true, data: { on: !!data, createdAt: typeof data === "string" ? data : null } });
  } catch (e) {
    const err = toDmsError(e);
    return fail(err.code, err.message, statusOf(err.code));
  }
}

/**
 * Makes the private calendar link, or replaces it (the old one stops working at once). Owners and admins only. The link is returned
 * once, here: only its hash is kept, so it cannot be shown again, only replaced.
 */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.", 403);
    const { db, membership } = await context();
    if (membership.role !== "owner" && membership.role !== "admin") throw new DmsError("forbidden", "Only an owner or admin can make the calendar link.");
    const token = newToken();
    const { error } = await db.rpc("calendar_feed_set", { p_workspace: membership.workspaceId, p_token_hash: hashToken(token) });
    if (error) throw new DmsError(error.code === "42501" ? "forbidden" : "internal", error.code === "42501" ? "Only an owner or admin can make the calendar link." : "Could not make the calendar link. Try again.");
    return json({ ok: true, data: { url: `${siteOrigin(req.url)}/api/calendar/feed/${token}.ics`, createdAt: new Date().toISOString() } });
  } catch (e) {
    const err = toDmsError(e);
    return fail(err.code, err.message, statusOf(err.code));
  }
}

/** Turns the private calendar link off. Owners and admins only. */
export async function DELETE(req: Request) {
  try {
    if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.", 403);
    const { db, membership } = await context();
    if (membership.role !== "owner" && membership.role !== "admin") throw new DmsError("forbidden", "Only an owner or admin can turn off the calendar link.");
    const { error } = await db.rpc("calendar_feed_off", { p_workspace: membership.workspaceId });
    if (error) throw new DmsError(error.code === "42501" ? "forbidden" : "internal", error.code === "42501" ? "Only an owner or admin can turn off the calendar link." : "Could not turn off the calendar link. Try again.");
    return json({ ok: true, data: { on: false } });
  } catch (e) {
    const err = toDmsError(e);
    return fail(err.code, err.message, statusOf(err.code));
  }
}
