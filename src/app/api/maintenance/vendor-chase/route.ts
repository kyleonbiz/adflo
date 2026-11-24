import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { replyAddress } from "@/lib/mail/reply-to";
import { reminderAddress, reminderMailReady, sendReminderEmail } from "@/lib/mail/send";
import { chaseEmail, chaseTargets, logAutoChase, withoutNote } from "@/lib/vendors/auto-chase";
import type { Vendor } from "@/lib/vendors/types";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const MAX_ROWS = 2000;
/** Whatever the records say, one run never sends more than this many emails in total. */
const MAX_PER_RUN = 300;

type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f<>",;]+/g, " ").replace(/\s{2,}/g, " ").trim();
// Saved records are plain JSON that a person (or an old version of the app) wrote: skip one that lacks the shape the chase needs.
const goodVendor = (r: Row): boolean => typeof r.data.name === "string" && typeof r.data.email === "string" && Array.isArray(r.data.documents) && r.data.documents.every(isObj);

/**
 * Weekday job (Vercel Cron): for each workspace that has switched on "Ask vendors for missing or expiring documents" in Settings
 * (off unless they did), emails each vendor who still owes a required document, on the business's behalf. Replies go to the
 * business email in Settings (or the workspace owner's email). At most three emails per vendor, a week apart; each is written on
 * the vendor's file first, so a failed save can never cause a repeat. Suspended and cancelled clients are skipped.
 * Protected by CRON_SECRET. `?dry=1` counts who would be emailed and sends nothing. Needs SUPABASE_SERVICE_ROLE_KEY and an email
 * sender (RESEND_API_KEY, or SMTP_USER and SMTP_PASSWORD).
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
  const { data: clients, error } = await admin.from("clients").select("name, workspace_id").in("status", ["trial", "active"]).not("workspace_id", "is", null);
  if (error) { await recordJobRun("vendor-chase", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let on = 0, due = 0, sent = 0, failed = 0, noReplyAddress = 0;
  for (const c of (clients ?? []) as { name: string; workspace_id: string }[]) {
    if (sent + failed >= MAX_PER_RUN) break;
    try {
      const load = async (kind: string): Promise<Row[]> => {
        const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", c.workspace_id).eq("kind", kind).limit(MAX_ROWS);
        return ((data ?? []) as Row[]).filter((r) => isObj(r.data));
      };
      const settings = (await load("settings"))[0]?.data;
      const optedIn = isObj(settings?.automation) && (settings!.automation as Record<string, unknown>).vendorChase === true;
      if (!optedIn) continue;
      on++;

      const rows = (await load("vendors")).filter(goodVendor);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const targets = chaseTargets(rows.map((r) => ({ ...r.data, id: r.id }) as unknown as Vendor), today);
      if (targets.length === 0) continue;
      due += targets.length;

      // Replies must reach the business: the email in Settings, else the first owner or admin.
      const replyTo = dry ? "x" : await replyAddress(admin, c.workspace_id, settings);
      if (!replyTo && !dry) { noReplyAddress++; continue; }
      if (dry) continue;

      const business = oneLine(c.name) || "Your business";
      const from = `${business} via AdFlo <${reminderAddress()}>`;
      for (const t of targets) {
        if (sent + failed >= MAX_PER_RUN) break;
        const row = byId.get(t.vendor.id)!;
        const noteId = `auto-${today}-${Math.random().toString(36).slice(2, 8)}`;
        const logged = logAutoChase(t.vendor, today, noteId);
        try {
          // Written to the vendor's file first: if this save fails nothing is sent, and if the email fails the note is taken back off.
          const save = await admin.from("workspace_records").update({ data: { ...row.data, activity: logged.activity }, updated_at: new Date().toISOString() }).eq("workspace_id", c.workspace_id).eq("kind", "vendors").eq("id", row.id);
          if (save.error) { failed++; continue; }
          try {
            await sendReminderEmail({ to: t.vendor.email.trim(), ...chaseEmail(t.vendor, today, { business }), from, replyTo });
            sent++;
          } catch {
            failed++;
            await admin.from("workspace_records").update({ data: { ...row.data, activity: withoutNote(logged, noteId).activity ?? [] }, updated_at: new Date().toISOString() }).eq("workspace_id", c.workspace_id).eq("kind", "vendors").eq("id", row.id);
          }
        } catch {
          failed++;
        }
      }
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("vendor-chase", failed === 0, `${sent} sent, ${failed} failed, ${on} workspace${on === 1 ? "" : "s"} on${noReplyAddress ? `, ${noReplyAddress} without a reply address` : ""}`);
  return reply({ ok: true, dry, workspacesOn: on, due, sent, failed, noReplyAddress }, 200);
}

export const GET = run;
export const POST = run;
