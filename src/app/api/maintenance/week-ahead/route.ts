import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { buildEvents } from "@/lib/calendar/logic";
import { loadCalendarSources } from "@/lib/calendar/server-sources";
import { recordJobRun } from "@/lib/control/job-runs";
import { ownerEmails } from "@/lib/mail/reply-to";
import { reminderMailReady, sendReminderEmail } from "@/lib/mail/send";
import { weekAhead, weekAheadEmail } from "@/lib/reminders/week-ahead";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX_RECIPIENTS = 5;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Monday job (Vercel Cron). For each workspace that has switched on the weekly summary in Settings, Notifications (off until then),
 * emails its owners and admins what is late and what falls in the next seven days: invoices due, licenses, tasks and milestones,
 * vendor documents, equipment, documents and reminders, the same items as the Calendar page. Nothing is sent when there is nothing.
 * Suspended and cancelled clients are skipped. Protected by CRON_SECRET. `?dry=1` counts and sends nothing.
 * It only runs on a Monday (UTC) unless `?force=1`, so a stray call midweek cannot send a second one.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 1 && url.searchParams.get("force") !== "1") return reply({ ok: true, skipped: "not Monday" }, 200);
  if (!dry && !reminderMailReady()) return reply({ ok: false, error: "Email is not set up (RESEND_API_KEY, or SMTP_USER and SMTP_PASSWORD)." }, 503);

  const origin = siteOrigin(req.url);
  const { data: clients, error } = await admin.from("clients").select("name, workspace_id").in("status", ["trial", "active"]).not("workspace_id", "is", null);
  if (error) { await recordJobRun("week-ahead", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let on = 0, due = 0, sent = 0, failed = 0;
  for (const c of (clients ?? []) as { name: string; workspace_id: string }[]) {
    try {
      const { data: rows } = await admin.from("workspace_records").select("data").eq("workspace_id", c.workspace_id).eq("kind", "settings").limit(1);
      const settings = (rows ?? []).map((r: { data: unknown }) => r.data).find(isObj);
      const enabled = isObj(settings?.notifications) && isObj((settings!.notifications as Record<string, unknown>).enabled) ? ((settings!.notifications as Record<string, unknown>).enabled as Record<string, unknown>) : {};
      if (enabled.weeklyDigest !== true) continue;
      on++;

      const week = weekAhead(buildEvents(await loadCalendarSources(admin, c.workspace_id), today), today);
      if (!week) continue;
      const emails = await ownerEmails(admin, c.workspace_id, MAX_RECIPIENTS);
      if (emails.length === 0) continue;
      due += emails.length;
      if (dry) continue;

      const mail = weekAheadEmail(week, { business: c.name, today, appUrl: `${origin}/app/calendar` });
      for (const to of emails) {
        try { await sendReminderEmail({ to, ...mail }); sent++; } catch { failed++; }
      }
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("week-ahead", failed === 0, `${sent} sent, ${failed} failed, ${on} workspace${on === 1 ? "" : "s"} on`);
  return reply({ ok: true, dry, workspacesOn: on, due, sent, failed }, 200);
}

export const GET = run;
export const POST = run;
