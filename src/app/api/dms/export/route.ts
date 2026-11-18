import { DmsError, toDmsError } from "@/lib/dms/errors";
import { logAppError } from "@/lib/control/errors";
import { findMembership, getDms } from "@/lib/dms/server/context";
import { checkRate } from "@/lib/dms/server/rate-limit";
import { json } from "@/lib/dms/server/respond";
import { buildWorkspaceExport, exportSize } from "@/lib/export/workspace-export";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// The export streams a whole workspace, so it may run for a while.
export const maxDuration = 300;

const EXPORT_RATE = { name: "workspace-export", max: 3, windowMs: 60 * 60_000 };
const fail = (code: string, message: string, status: number) => json({ ok: false, error: { code, message } }, status);

/** Downloads the whole workspace as a zip. Owners and admins only. */
export async function GET(req: Request) {
  let userId: string | undefined;
  try {
    const dms = await getDms();
    userId = dms.userId;
    if (dms.mode !== "live") throw new DmsError("unavailable", "Exporting needs a connected workspace.");
    const db = await createServerSupabase();
    const membership = await findMembership(db, dms.userId);
    if (!membership) throw new DmsError("not_found", "You do not belong to a workspace yet.");
    if (membership.role !== "owner" && membership.role !== "admin") throw new DmsError("forbidden", "Only owners and admins can export the workspace.");
    // `?check=1` answers in JSON whether an export is possible, before the browser starts a download (so a refusal is shown, not saved as a file).
    if (new URL(req.url).searchParams.get("check") === "1") {
      const size = await exportSize(db, membership.workspaceId);
      return size.tooLarge
        ? fail("too_large", "This workspace holds more than one export can carry. Contact support and we will prepare it for you.", 413)
        : json({ ok: true, data: size });
    }
    if (!checkRate(dms.userId, EXPORT_RATE).ok) return fail("rate_limited", "You can export a few times an hour. Please try again later.", 429);

    const { data: ws } = await db.from("workspaces").select("id, name").eq("id", membership.workspaceId).maybeSingle();
    if (!ws) throw new DmsError("not_found", "Workspace not found.");
    const out = await buildWorkspaceExport(db, { id: String(ws.id), name: String(ws.name) });
    if (out.tooLarge || !out.stream) {
      return fail("too_large", "This workspace holds more than one export can carry. Contact support and we will prepare it for you.", 413);
    }
    return new Response(out.stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${out.filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    const err = toDmsError(e);
    if (err.code === "internal") await logAppError("GET /api/dms/export", e, { status: err.status, userId });
    return fail(err.code, err.message, err.status);
  }
}
