import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { logAutomation } from "@/lib/audit/server";
import { recordJobRun } from "@/lib/control/job-runs";
import { ownerEmails } from "@/lib/mail/reply-to";
import { reminderMailReady, sendReminderEmail } from "@/lib/mail/send";
import { reportEmail } from "@/lib/reporting/email";
import { buildReports, emptySources, type ReportSources } from "@/lib/reporting/logic";
import { markDelivered, parseRecipients, SCHEDULE_EVERY, type ScheduledReport } from "@/lib/reporting/schedule";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX_ROWS = 2000;
/** One run delivers at most this many reports, and each goes to at most this many people. */
const MAX_REPORTS_PER_RUN = 100;
const MAX_RECIPIENTS = 5;

type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Saved records are plain JSON that a person (or an old version of the app) wrote: skip one that lacks the shape the reports read.
const good: Record<string, (d: Record<string, unknown>) => boolean> = {
  invoices: (d) => typeof d.number === "string" && typeof d.client === "string" && isDay(d.dueOn) && isDay(d.issuedOn) && typeof d.status === "string" && Number.isFinite(d.amountCents) && Array.isArray(d.items),
  licenses: (d) => typeof d.name === "string" && isDay(d.expiresOn) && Array.isArray(d.reminderDays) && d.reminderDays.every((n) => Number.isInteger(n)) && Array.isArray(d.requiredDocuments) && d.requiredDocuments.every(isObj),
  projects: (d) => typeof d.name === "string" && Array.isArray(d.tasks) && d.tasks.every(isObj) && (d.milestones === undefined || (Array.isArray(d.milestones) && d.milestones.every(isObj))),
  vendors: (d) => typeof d.name === "string" && Array.isArray(d.documents) && d.documents.every(isObj) && (d.activity === undefined || (Array.isArray(d.activity) && d.activity.every(isObj))),
  equipment: (d) => typeof d.name === "string" && typeof d.status === "string",
  contacts: (d) => typeof d.name === "string",
};
const goodSchedule = (d: Record<string, unknown>) => typeof d.reportId === "string" && typeof d.recipients === "string" && isDay(d.nextOn) && SCHEDULE_EVERY.some((e) => e.value === d.every);

/**
 * Daily job (Vercel Cron). Emails the reports a workspace has scheduled in Reporting (the business summary or any one service's
 * report) on the day they fall due, to the addresses listed on the schedule, or to the workspace's owners and admins when none are.
 * Each schedule's next date is moved on first, so a failed save can never cause a repeat, and moved back if nothing could be sent.
 * A long gap is skipped, not replayed. Suspended and cancelled clients are skipped. Protected by CRON_SECRET. `?dry=1` counts
 * the reports that are due and changes nothing.
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
  if (error) { await recordJobRun("scheduled-reports", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let due = 0, sent = 0, failed = 0, noRecipient = 0;
  for (const c of (clients ?? []) as { name: string; workspace_id: string }[]) {
    if (due >= MAX_REPORTS_PER_RUN) break;
    try {
      const ws = c.workspace_id;
      const load = async (kind: string): Promise<Row[]> => {
        const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", ws).eq("kind", kind).limit(MAX_ROWS);
        return ((data ?? []) as Row[]).filter((r) => isObj(r.data));
      };
      const schedules = (await load("schedules")).filter((r) => goodSchedule(r.data)).map((r) => ({ row: r, s: { ...r.data, id: r.id } as unknown as ScheduledReport })).filter((x) => x.s.nextOn <= today);
      if (schedules.length === 0) continue;

      const pick = async (kind: string) => (await load(kind)).filter((r) => good[kind](r.data)).map((r) => ({ ...r.data, id: r.id }));
      const sources = { ...emptySources(), invoices: await pick("invoices"), licenses: await pick("licenses"), projects: await pick("projects"), vendors: await pick("vendors"), equipment: await pick("equipment"), contacts: await pick("contacts") } as unknown as ReportSources;
      const reports = buildReports(sources, today);
      let owners: string[] | null = null;

      for (const { row, s } of schedules) {
        if (due >= MAX_REPORTS_PER_RUN) break;
        due++;
        if (dry) continue;
        const listed = parseRecipients(s.recipients).valid.slice(0, MAX_RECIPIENTS);
        const to = listed.length > 0 ? listed : (owners ??= await ownerEmails(admin, ws, MAX_RECIPIENTS));
        if (to.length === 0) { noRecipient++; continue; }
        const mail = reportEmail(s.reportId, reports, { business: c.name, today, appUrl: `${origin}/app/reporting` });
        const next = markDelivered([s], s.id, today)[0].nextOn;
        const save = (nextOn: string) => admin.from("workspace_records").update({ data: { ...row.data, nextOn }, updated_at: new Date().toISOString() }).eq("workspace_id", ws).eq("kind", "schedules").eq("id", row.id);
        // Moved on first: if this save fails nothing is sent, and if no email could be sent the date is put back so it is tried tomorrow.
        if ((await save(next)).error) { failed++; continue; }
        if (!mail) continue; // the report no longer exists: its date moves on and nothing is sent
        let delivered = 0;
        for (const addr of to) {
          try { await sendReminderEmail({ to: addr, ...mail }); delivered++; } catch { failed++; }
        }
        if (delivered === 0) { await save(s.nextOn); continue; }
        sent += delivered;
        await logAutomation(admin, ws, today, [{ job: "scheduled-reports", key: s.id, verb: "emailed the scheduled report", what: `${mail.subject.split(": ").slice(1).join(": ") || "report"} to ${delivered} ${delivered === 1 ? "person" : "people"}`, area: "Reports", href: "/app/reporting" }]);
      }
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("scheduled-reports", failed === 0, `${sent} emails for ${due} due, ${failed} failed${noRecipient ? `, ${noRecipient} without a recipient` : ""}`);
  return reply({ ok: true, dry, due, sent, failed, noRecipient }, 200);
}

export const GET = run;
export const POST = run;
