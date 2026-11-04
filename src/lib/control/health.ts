import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey } from "@/lib/supabase/env";
import type { HealthCheck } from "./types";

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
  checks.push(process.env.CRON_SECRET
    ? { name: "Scheduled cleanup", level: "ok", detail: "The cleanup and reindex jobs are protected by a secret." }
    : { name: "Scheduled cleanup", level: "warn", detail: "CRON_SECRET is not set, so the scheduled cleanup jobs cannot run." });
  checks.push(process.env.ANTHROPIC_API_KEY
    ? { name: "Assistant (Addy)", level: "ok", detail: "An API key is configured." }
    : { name: "Assistant (Addy)", level: "warn", detail: "ANTHROPIC_API_KEY is not set, so the assistant cannot answer." });
  checks.push(process.env.DMS_ALLOW_DEV_MODE === "true"
    ? { name: "Development mode", level: "warn", detail: "DMS_ALLOW_DEV_MODE is on. Turn it off in production." }
    : { name: "Development mode", level: "ok", detail: "Off." });
  return checks;
}
