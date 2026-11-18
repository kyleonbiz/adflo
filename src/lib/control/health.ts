import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey } from "@/lib/supabase/env";
import type { HealthCheck } from "./types";

export interface JobRun { ran_at: string; ok: boolean; detail: string }

/** The job is scheduled daily; a run older than this (a missed night plus slack) means the schedule is not firing. */
export const CLEANUP_STALE_HOURS = 36;

/** What the Monitoring page says about the nightly cleanup: that it is set up, and, from its last recorded run, that it really runs. */
export function cleanupCheck(secretSet: boolean, run: JobRun | null, now = Date.now(), name = "Scheduled cleanup"): HealthCheck {
  if (!secretSet) return { name, level: "warn", detail: "CRON_SECRET is not set, so the scheduled cleanup jobs cannot run." };
  if (!run) return { name, level: "warn", detail: "It has not run yet. The first run is at 03:17 UTC; if it still shows this tomorrow, check Cron Jobs in Vercel." };
  const hours = Math.max(0, Math.floor((now - Date.parse(run.ran_at)) / 3_600_000));
  const when = hours < 1 ? "less than an hour ago" : `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (hours > CLEANUP_STALE_HOURS) return { name, level: "warn", detail: `Last ran ${when}. It should run every night; check Cron Jobs in Vercel.` };
  if (!run.ok) return { name, level: "warn", detail: `Last ran ${when} but hit a problem. ${run.detail}`.trim() };
  return { name, level: "ok", detail: `Last ran ${when}. ${run.detail}`.trim() };
}

/**
 * Quick checks that the pieces AdFlo relies on are in place. It reports what is configured and whether the database
 * answers; it cannot see a provider's own outages. Nothing here exposes a key or its value.
 */
export async function runHealthChecks(supabase: SupabaseClient): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const t0 = Date.now();
  const { error } = await supabase.from("plans").select("id", { head: true, count: "exact" });
  const ms = Date.now() - t0;
  checks.push(error
    ? { name: "Database", level: "down", detail: "The database did not answer. Check Supabase." }
    : { name: "Database", level: ms > 1500 ? "warn" : "ok", detail: `Answered in ${ms} ms.` });
  checks.push(getServiceRoleKey()
    ? { name: "Error logging", level: "ok", detail: "Server errors are recorded." }
    : { name: "Error logging", level: "warn", detail: "SUPABASE_SERVICE_ROLE_KEY is not set, so server errors are not recorded." });
  const { data: runs } = await supabase.from("job_runs").select("job, ran_at, ok, detail").in("job", ["cleanup-uploads", "purge-workspaces"]);
  const lastRun = (job: string) => ((runs ?? []) as (JobRun & { job: string })[]).find((r) => r.job === job) ?? null;
  checks.push(cleanupCheck(!!process.env.CRON_SECRET, lastRun("cleanup-uploads")));
  checks.push(cleanupCheck(!!process.env.CRON_SECRET, lastRun("purge-workspaces"), Date.now(), "Closed workspaces"));
  checks.push(process.env.ANTHROPIC_API_KEY
    ? { name: "Assistant (Addy)", level: "ok", detail: "An API key is configured." }
    : { name: "Assistant (Addy)", level: "warn", detail: "ANTHROPIC_API_KEY is not set, so the assistant cannot answer." });
  checks.push(process.env.DMS_ALLOW_DEV_MODE === "true"
    ? { name: "Development mode", level: "warn", detail: "DMS_ALLOW_DEV_MODE is on. Turn it off in production." }
    : { name: "Development mode", level: "ok", detail: "Off." });
  return checks;
}
