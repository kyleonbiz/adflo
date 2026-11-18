import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { purgeDueWorkspaces } from "@/lib/dms/server/purge-workspaces";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const reply = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * Nightly: erases workspaces whose 30-day closing period has ended (see purge-workspaces.ts). Protected by CRON_SECRET, sent as
 * `Authorization: Bearer <secret>` (what Vercel Cron sends) or `x-cron-secret`. Returns counts only.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  try {
    const r = await purgeDueWorkspaces(admin);
    await recordJobRun("purge-workspaces", r.failed === 0, `${r.deleted} of ${r.found} closed workspace${r.found === 1 ? "" : "s"} erased${r.failed ? `, ${r.failed} will be retried tomorrow` : ""}.`);
    return reply({ ok: true, ...r }, 200);
  } catch {
    await recordJobRun("purge-workspaces", false, "The job failed.");
    return reply({ ok: false, error: "Failed." }, 500);
  }
}

export const GET = run;
export const POST = run;
