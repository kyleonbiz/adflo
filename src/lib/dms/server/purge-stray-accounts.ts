import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STRAY_GRACE_DAYS = 7;
export interface StrayResult { found: number; removed: number; failed: number }

/**
 * Removes sign-in accounts that belong to nobody: in no workspace, not staff, not the owner of a trial or active client, with no
 * invitation in the last week, and a week old. The database function decides who qualifies; this only deletes them, a few at a
 * time. With `dry` it only counts. Counts only: never emails or ids.
 */
export async function purgeStrayAccounts(admin: SupabaseClient, dry = false): Promise<StrayResult> {
  const result: StrayResult = { found: 0, removed: 0, failed: 0 };
  const { data, error } = await admin.rpc("dms_stray_accounts", { p_grace: `${STRAY_GRACE_DAYS} days` });
  if (error) throw new Error("stray_list_failed");
  const strays = (data as { id: string }[] | null) ?? [];
  result.found = strays.length;
  if (dry) return result;
  for (const s of strays) {
    try {
      const rm = await admin.auth.admin.deleteUser(s.id);
      if (rm.error) result.failed++; else result.removed++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
