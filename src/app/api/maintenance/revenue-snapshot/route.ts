import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { recordRevenueSnapshot } from "@/lib/control/snapshots";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * Daily job (Vercel Cron, just before midnight UTC): records what AdFlo's recurring revenue stands at, so the Control center's
 * Sales & revenue page can show a trend. Protected by CRON_SECRET; needs SUPABASE_SERVICE_ROLE_KEY. Returns counts and amounts only.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const snap = await recordRevenueSnapshot(admin, new Date().toISOString().slice(0, 10));
  await recordJobRun("revenue-snapshot", !!snap, snap ? `${snap.activeClients} active` : "could not record");
  return snap ? reply({ ok: true, day: snap.day, mrrCents: snap.mrrCents, activeClients: snap.activeClients }, 200) : reply({ ok: false, error: "Could not record the snapshot." }, 500);
}

export const GET = run;
export const POST = run;
