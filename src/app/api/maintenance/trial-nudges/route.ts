import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { dueNudge, trialNudgeEmail, type TrialNudge } from "@/lib/control/trial-nudge";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX_PER_RUN = 200;
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
const COLUMN: Record<TrialNudge, "trial_ending_sent_at" | "trial_ended_sent_at"> = { ending: "trial_ending_sent_at", ended: "trial_ended_sent_at" };

type Row = { id: string; name: string; status: string; owner_name: string | null; owner_email: string | null; workspace_id: string | null; stripe_subscription_id: string | null; billing_status: string | null; trial_ends_at: string | null; trial_ending_sent_at: string | null; trial_ended_sent_at: string | null };

/**
 * Daily job (Vercel Cron): a free trial's owner is emailed once when the trial is about to end, and once after it has ended, with a
 * link to continue. Only self-serve trials that have not subscribed and have no workspace. Each email is claimed in the database
 * first (its time is set where it is still empty), so a rerun never sends it twice, and the claim is released if sending fails.
 * Protected by CRON_SECRET. `?dry=1` counts who is due. Needs SMTP_USER, SMTP_PASSWORD and SUPABASE_SERVICE_ROLE_KEY.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (!dry && !onboardingMailReady()) return reply({ ok: false, error: "Email is not set up (SMTP_USER and SMTP_PASSWORD)." }, 503);

  const { data, error } = await admin.from("clients")
    .select("id, name, status, owner_name, owner_email, workspace_id, stripe_subscription_id, billing_status, trial_ends_at, trial_ending_sent_at, trial_ended_sent_at")
    .eq("self_serve", true).eq("status", "trial").is("workspace_id", null).not("trial_ends_at", "is", null);
  if (error) { await recordJobRun("trial-nudges", false, "could not load trials"); return reply({ ok: false, error: "Could not load trials." }, 500); }

  const now = new Date();
  const continueUrl = `${siteOrigin(req.url)}/trial/continue`;
  let ending = 0, ended = 0, failed = 0, noEmail = 0;
  for (const c of (data ?? []) as Row[]) {
    if (ending + ended + failed >= MAX_PER_RUN) break;
    const kind = dueNudge({ selfServe: true, status: c.status, workspaceId: c.workspace_id, hasSubscription: !!c.stripe_subscription_id && ["active", "trialing", "past_due"].includes(c.billing_status ?? ""), endsAt: c.trial_ends_at, endingSentAt: c.trial_ending_sent_at, endedSentAt: c.trial_ended_sent_at }, now);
    if (!kind) continue;
    const to = (c.owner_email ?? "").trim();
    if (!EMAIL.test(to)) { noEmail++; continue; }
    if (dry) { if (kind === "ending") ending++; else ended++; continue; }
    const col = COLUMN[kind];
    try {
      // Claimed first: only one run can set it, so only one run sends.
      const { data: claimed, error: e } = await admin.from("clients").update({ [col]: now.toISOString() }).eq("id", c.id).is(col, null).select("id");
      if (e) { failed++; continue; }
      if (!claimed?.length) continue;
      try {
        await sendOnboardingEmail({ to, ...trialNudgeEmail(kind, { company: c.name, ownerName: c.owner_name ?? "", continueUrl }) });
        if (kind === "ending") ending++; else ended++;
      } catch {
        failed++;
        await admin.from("clients").update({ [col]: null }).eq("id", c.id);
      }
    } catch { failed++; }
  }
  if (!dry) await recordJobRun("trial-nudges", failed === 0, `${ending} ending, ${ended} ended, ${failed} failed${noEmail ? `, ${noEmail} without an email` : ""}`);
  // Counts only: no names or addresses are returned or logged.
  return reply({ ok: true, dry, ending, ended, failed, noEmail }, 200);
}

export const GET = run;
export const POST = run;
