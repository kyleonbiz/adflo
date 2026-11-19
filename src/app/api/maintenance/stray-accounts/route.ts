import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { purgeStrayAccounts } from "@/lib/dms/server/purge-stray-accounts";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * Nightly: removes sign-in accounts that belong to nobody (see purge-stray-accounts.ts), so every account stays tied to a client.
 * Protected by CRON_SECRET, sent as `Authorization: Bearer <secret>` (what Vercel Cron sends) or `x-cron-secret`.
 * `?dry=1` only counts. Returns counts only.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  try {
    const r = await purgeStrayAccounts(admin, dry);
    if (!dry) await recordJobRun("stray-accounts", r.failed === 0, `${r.removed} of ${r.found} stray account${r.found === 1 ? "" : "s"} removed${r.failed ? `, ${r.failed} will be retried tomorrow` : ""}.`);
    return reply({ ok: true, dry, ...r }, 200);
  } catch {
    if (!dry) await recordJobRun("stray-accounts", false, "The job failed.");
    return reply({ ok: false, error: "Failed." }, 500);
  }
}

export const GET = run;
export const POST = run;
