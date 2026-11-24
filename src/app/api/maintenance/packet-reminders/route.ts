import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { reminderMailReady } from "@/lib/mail/send";
import { reminderDue, type Assignment } from "@/lib/packets/logic";
import { sendPacketEmail } from "@/lib/packets/server";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const MAX_ROWS = 2000;
/** Whatever the records say, one run never sends more than this many emails in total. */
const MAX_PER_RUN = 300;

type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
// Saved records are plain JSON that a person (or an old version of the app) wrote: skip one that lacks the shape this needs.
const goodPacket = (r: Row): boolean => {
  const d = r.data;
  return typeof d.recipient === "string" && typeof d.email === "string" && typeof d.templateName === "string" && isDay(d.startedOn)
    && Array.isArray(d.items) && d.items.every((i) => isObj(i) && typeof i.id === "string" && typeof i.label === "string" && typeof i.kind === "string")
    && (d.sentOn === undefined || isDay(d.sentOn)) && (d.remindedOn === undefined || (Array.isArray(d.remindedOn) && d.remindedOn.every(isDay)));
};

/**
 * Weekday job (Vercel Cron): for each workspace that has switched on "Remind people about unfinished packets" in Settings (off until
 * then), emails each person who was sent an onboarding packet and still owes something: 3 days after it was sent, then a week apart,
 * up to three reminders. Only what is still outstanding is listed, and steps the business does itself are never asked of the person.
 * It stops by itself once everything of theirs is ticked off. Each reminder is recorded on the packet first, so a failed save can never
 * cause a repeat, and taken back if the email fails. Replies go to the business. Suspended and cancelled clients are skipped.
 * Protected by CRON_SECRET. `?dry=1` counts who would be emailed and changes nothing.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (!dry && !reminderMailReady()) return reply({ ok: false, error: "Email is not set up (RESEND_API_KEY, or SMTP_USER and SMTP_PASSWORD)." }, 503);

  const today = new Date().toISOString().slice(0, 10);
  const origin = siteOrigin(req.url);
  const { data: clients, error } = await admin.from("clients").select("name, workspace_id").in("status", ["trial", "active"]).not("workspace_id", "is", null);
  if (error) { await recordJobRun("packet-reminders", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let on = 0, due = 0, sent = 0, failed = 0, noReply = 0;
  for (const c of (clients ?? []) as { name: string; workspace_id: string }[]) {
    if (sent + failed >= MAX_PER_RUN) break;
    try {
      const wsId = c.workspace_id;
      const load = async (kind: string): Promise<Row[]> => {
        const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", wsId).eq("kind", kind).limit(MAX_ROWS);
        return ((data ?? []) as Row[]).filter((r) => isObj(r.data));
      };
      const settings = (await load("settings"))[0]?.data;
      if (!(isObj(settings?.automation) && (settings!.automation as Record<string, unknown>).packetReminders === true)) continue;
      on++;

      const rows = (await load("packets")).filter(goodPacket);
      for (const r of rows) {
        if (sent + failed >= MAX_PER_RUN) break;
        const a = { ...r.data, id: r.id } as unknown as Assignment;
        if (!reminderDue(a, today)) continue;
        due++;
        if (dry) continue;
        const reminded = [...(a.remindedOn ?? []), today];
        const save = (data: Record<string, unknown>) => admin.from("workspace_records").update({ data, updated_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("kind", "packets").eq("id", r.id);
        // Recorded on the packet first: if this save fails nothing is sent, and if the email fails the record is taken back.
        if ((await save({ ...r.data, remindedOn: reminded })).error) { failed++; continue; }
        try {
          const res = await sendPacketEmail(admin, { workspaceId: wsId, business: c.name, origin, settings, assignment: a, kind: "reminder", n: reminded.length });
          if (res.ok) sent++;
          else { if (res.code === "no_reply_address") noReply++; await save(r.data); }
        } catch {
          failed++;
          await save(r.data);
        }
      }
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("packet-reminders", failed === 0, `${sent} sent, ${failed} failed, ${on} workspace${on === 1 ? "" : "s"} on${noReply ? `, ${noReply} without a reply address` : ""}`);
  return reply({ ok: true, dry, workspacesOn: on, due, sent, failed, noReply }, 200);
}

export const GET = run;
export const POST = run;
