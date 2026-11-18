import "server-only";
import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * Notes that a scheduled job just ran, for the Monitoring page. `detail` is counts only (never keys, file names or data).
 * Best effort: a failure here must never fail the job itself.
 */
export async function recordJobRun(job: string, ok: boolean, detail = ""): Promise<void> {
  try {
    const db = createServiceSupabase();
    if (!db) return;
    await db.from("job_runs").upsert({ job: job.slice(0, 80), ok, detail: detail.slice(0, 200), ran_at: new Date().toISOString() }, { onConflict: "job" });
  } catch {
    // Never let bookkeeping break a job.
  }
}
