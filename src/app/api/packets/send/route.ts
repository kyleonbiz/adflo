import { DmsError, toDmsError } from "@/lib/dms/errors";
import { can } from "@/lib/dms/service";
import { findMembership, getDms } from "@/lib/dms/server/context";
import { checkRate } from "@/lib/dms/server/rate-limit";
import { json, sameOrigin } from "@/lib/dms/server/respond";
import { reminderMailReady } from "@/lib/mail/send";
import { outstanding, type Assignment } from "@/lib/packets/logic";
import { sendPacketEmail } from "@/lib/packets/server";
import { siteOrigin } from "@/lib/site-url";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RATE = { name: "packet-send", max: 30, windowMs: 60 * 60_000 };
const fail = (code: string, message: string, status: number) => json({ ok: false, error: { code, message } }, status);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * "Email packet": sends one packet to the person it is for, in the business's name, and records that it was sent (which is what lets
 * automatic reminders follow up, if the workspace has switched them on). Members who can edit only; connected workspaces only.
 * Sending again later counts as a reminder, so a person is never emailed the same thing twice in a row without it being on record.
 */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return fail("forbidden", "Cross-origin request blocked.", 403);
    const dms = await getDms();
    if (dms.mode !== "live") throw new DmsError("unavailable", "Emailing a packet needs a connected workspace.");
    const db = await createServerSupabase();
    const membership = await findMembership(db, dms.userId);
    if (!membership) throw new DmsError("not_found", "You do not belong to a workspace yet.");
    if (!can(membership.role, "write")) throw new DmsError("forbidden", "Your role cannot send packets.");
    if (!reminderMailReady()) return fail("mail_off", "Email is not switched on yet, so nothing was sent.", 503);
    if (!checkRate(dms.userId, RATE).ok) return fail("rate_limited", "You can email a few packets an hour. Please try again later.", 429);

    const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
    const id = typeof body?.id === "string" ? body.id.slice(0, 80) : "";
    if (!id) return fail("invalid", "Choose a packet.", 400);

    const ws = membership.workspaceId;
    const { data: row } = await db.from("workspace_records").select("id, data").eq("workspace_id", ws).eq("kind", "packets").eq("id", id).maybeSingle();
    if (!row || !isObj(row.data) || !Array.isArray(row.data.items) || typeof row.data.recipient !== "string") return fail("not_found", "That packet no longer exists.", 404);
    const a = { ...row.data, id } as unknown as Assignment;
    if (outstanding(a).length === 0) return fail("nothing_to_send", "Everything the person had to provide is already in.", 409);

    const [{ data: settingsRow }, { data: workspace }] = await Promise.all([
      db.from("workspace_records").select("data").eq("workspace_id", ws).eq("kind", "settings").limit(1).maybeSingle(),
      db.from("workspaces").select("name").eq("id", ws).maybeSingle(),
    ]);
    const settings = isObj(settingsRow?.data) ? (settingsRow!.data as Record<string, unknown>) : undefined;
    const today = new Date().toISOString().slice(0, 10);
    const first = !a.sentOn;
    const reminded = [...(a.remindedOn ?? []), ...(first ? [] : [today])];
    const next = { ...row.data, ...(first ? { sentOn: today } : { remindedOn: reminded }) };

    // Recorded first: if this save fails nothing is sent, and if the email fails the record is taken back off.
    const save = await db.from("workspace_records").update({ data: next, updated_at: new Date().toISOString() }).eq("workspace_id", ws).eq("kind", "packets").eq("id", id);
    if (save.error) return fail("save_failed", "Could not save that the packet was sent, so nothing was emailed. Try again.", 500);
    let result;
    try {
      result = await sendPacketEmail(db, { workspaceId: ws, business: String(workspace?.name ?? ""), origin: siteOrigin(req.url), settings, assignment: a, kind: first ? "first" : "reminder", n: first ? 0 : reminded.length });
    } catch {
      await db.from("workspace_records").update({ data: row.data, updated_at: new Date().toISOString() }).eq("workspace_id", ws).eq("kind", "packets").eq("id", id);
      return fail("mail_failed", "The email could not be sent. Try again in a moment.", 502);
    }
    if (!result.ok) {
      await db.from("workspace_records").update({ data: row.data, updated_at: new Date().toISOString() }).eq("workspace_id", ws).eq("kind", "packets").eq("id", id);
      return fail(result.code, result.message, result.code === "no_email" ? 409 : 422);
    }
    return json({ ok: true, data: { emailedTo: result.emailedTo, sentOn: (next as { sentOn?: string }).sentOn ?? a.sentOn ?? today, remindedOn: (next as { remindedOn?: string[] }).remindedOn ?? a.remindedOn ?? [] } });
  } catch (e) {
    const err = toDmsError(e);
    return fail(err.code, err.message, err.code === "unauthenticated" ? 401 : err.code === "forbidden" ? 403 : err.code === "not_found" ? 404 : err.code === "unavailable" ? 503 : 500);
  }
}
