import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { buildDigest, digestEmail } from "@/lib/reminders/digest";
import { reminderMailReady, sendReminderEmail } from "@/lib/mail/send";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { Equipment } from "@/lib/equipment/types";
import type { License } from "@/lib/licenses/types";
import type { Vendor } from "@/lib/vendors/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const MAX_RECIPIENTS = 5;
const MAX_ROWS = 2000;

type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDayString = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Saved records are plain JSON that a person (or an old version of the app) wrote, so check the shape the logic needs
// and skip a record that does not have it, rather than let one bad row stop everyone's reminders.
const goodLicense = (r: Row): boolean => typeof r.data.name === "string" && isDayString(r.data.expiresOn) && Array.isArray(r.data.reminderDays) && r.data.reminderDays.every((n) => Number.isInteger(n)) && Array.isArray(r.data.requiredDocuments);
const goodVendor = (r: Row): boolean => typeof r.data.name === "string" && Array.isArray(r.data.documents) && r.data.documents.every(isObj);
const goodEquipment = (r: Row): boolean => typeof r.data.name === "string" && typeof r.data.status === "string";

/**
 * Daily job (Vercel Cron): emails each workspace's owners and admins about licenses, vendor documents and equipment that
 * are overdue or coming due: on a license's reminder days, and a Monday roundup. A workspace that has switched renewal
 * reminders off in Settings is skipped, as are suspended and cancelled clients. Protected by CRON_SECRET.
 * `?dry=1` counts who would get an email and sends nothing. Needs SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY
 * (or SMTP_USER and SMTP_PASSWORD).
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
  if (error) { await recordJobRun("renewal-reminders", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let due = 0, sent = 0, failed = 0, skipped = 0;
  for (const c of (clients ?? []) as { name: string; workspace_id: string }[]) {
    try {
      const load = async (kind: string): Promise<Row[]> => {
        const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", c.workspace_id).eq("kind", kind).limit(MAX_ROWS);
        return ((data ?? []) as Row[]).filter((r) => isObj(r.data));
      };
      const settings = await load("settings");
      const prefs = settings.map((s) => (s.data.notifications as { enabled?: { renewals?: unknown } } | undefined)?.enabled?.renewals);
      if (prefs.some((p) => p === false)) { skipped++; continue; }

      const [licenses, vendors, equipment] = await Promise.all([load("licenses"), load("vendors"), load("equipment")]);
      const digest = buildDigest({
        licenses: licenses.filter(goodLicense).map((r) => ({ ...r.data, id: r.id }) as unknown as License),
        vendors: vendors.filter(goodVendor).map((r) => ({ ...r.data, id: r.id }) as unknown as Vendor),
        equipment: equipment.filter(goodEquipment).map((r) => ({ ...r.data, id: r.id }) as unknown as Equipment),
      }, today);
      if (!digest) continue;

      const { data: members } = await admin.from("workspace_members").select("user_id, role").eq("workspace_id", c.workspace_id).in("role", ["owner", "admin"]).limit(MAX_RECIPIENTS);
      const emails: string[] = [];
      for (const m of (members ?? []) as { user_id: string }[]) {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        const e = data.user?.email?.trim();
        if (e && data.user?.email_confirmed_at) emails.push(e);
      }
      if (emails.length === 0) continue;
      due += emails.length;
      if (dry) continue;

      const mail = digestEmail(digest, { team: c.name, appUrl: `${origin}/app/overview` });
      for (const to of emails) {
        try { await sendReminderEmail({ to, ...mail }); sent++; } catch { failed++; }
      }
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("renewal-reminders", failed === 0, `${sent} sent, ${failed} failed, ${skipped} off`);
  return reply({ ok: true, dry, due, sent, failed, skipped }, 200);
}

export const GET = run;
export const POST = run;
