import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditArea } from "./logic";

/** One thing an automation did, in the words of the activity log: "AdFlo <verb> <what>". */
export interface AutomationLine {
  /** Which job wrote it, so the id is stable per job. */
  job: string;
  /** What it was done to: the same thing on the same day is only ever written once (a rerun is harmless). */
  key: string;
  verb: string;
  what: string;
  area: AuditArea;
  href: string;
}

const clean = (s: string, max: number) => s.replace(/[\r\n\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);

/**
 * Writes what an automation did to a workspace's activity log, under the name "AdFlo", so the team can see every email sent and
 * record created on their behalf. Server only (the service role). Never throws: the log is a record of the work, so a failure to
 * write it must not undo or stop the work. The id is made from the job, the day and the key, so running a job twice writes a line once.
 */
export async function logAutomation(admin: SupabaseClient, workspaceId: string, today: string, lines: AutomationLine[]): Promise<void> {
  if (lines.length === 0) return;
  try {
    const rows = lines.slice(0, 50).map((l) => ({
      workspace_id: workspaceId,
      id: clean(`auto-${l.job}-${today}-${l.key}`, 80),
      data: { by: "AdFlo", verb: clean(l.verb, 80), what: clean(l.what, 200), area: l.area, href: l.href.startsWith("/app") ? l.href : "/app" },
    }));
    await admin.from("workspace_activity").upsert(rows, { onConflict: "workspace_id,id", ignoreDuplicates: true });
  } catch { /* the work is done either way */ }
}
