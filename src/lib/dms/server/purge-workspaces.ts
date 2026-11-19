import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DELETION_GRACE_DAYS } from "../deletion";
import { DOCUMENTS_BUCKET } from "../supabase/storage";

const PAGE = 1000;
const REMOVE_BATCH = 100;
/** One night's work is bounded: this many workspaces at most (the database function also caps the list). */
interface PurgeResult { found: number; deleted: number; failed: number; objectsRemoved: number; accountsRemoved: number }

async function storageKeys(admin: SupabaseClient, workspaceId: string): Promise<string[]> {
  const keys = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from("document_versions").select("storage_key").eq("workspace_id", workspaceId).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error("purge_read_failed");
    for (const r of data ?? []) if (r.storage_key) keys.add(String(r.storage_key));
    if (!data || data.length < PAGE) break;
  }
  return [...keys];
}

/**
 * Erases one workspace: its stored files first, then the workspace row (the database removes everything that belongs to it).
 * If any file cannot be removed the workspace is left alone, so nothing is orphaned in storage and the caller can try again.
 * Used by the nightly job and by the Control center's "delete workspace and data". Never throws; counts only.
 */
export async function purgeWorkspace(admin: SupabaseClient, workspaceId: string): Promise<{ ok: boolean; objectsRemoved: number }> {
  let objectsRemoved = 0;
  try {
    const keys = await storageKeys(admin, workspaceId);
    let storageFailed = false;
    for (let i = 0; i < keys.length; i += REMOVE_BATCH) {
      const batch = keys.slice(i, i + REMOVE_BATCH);
      const res = await admin.storage.from(DOCUMENTS_BUCKET).remove(batch);
      if (res.error) storageFailed = true; else objectsRemoved += batch.length;
    }
    if (storageFailed) return { ok: false, objectsRemoved };
    const del = await admin.from("workspaces").delete().eq("id", workspaceId);
    return { ok: !del.error, objectsRemoved };
  } catch {
    return { ok: false, objectsRemoved };
  }
}

/**
 * Erases every workspace whose 30-day grace period has ended: the stored files first, then the workspace row (the database removes
 * everything that belongs to it), then the sign-in of the person who closed it, but only if it belongs to no other workspace and is
 * not a staff account. If any file cannot be removed the workspace is left for the next night, so nothing is orphaned in storage.
 * Counts only: never ids, names or file keys.
 */
export async function purgeDueWorkspaces(admin: SupabaseClient): Promise<PurgeResult> {
  const result: PurgeResult = { found: 0, deleted: 0, failed: 0, objectsRemoved: 0, accountsRemoved: 0 };
  const { data, error } = await admin.rpc("dms_due_workspace_deletions", { p_grace: `${DELETION_GRACE_DAYS} days` });
  if (error) throw new Error("purge_list_failed");
  const due = (data as { id: string; requested_by: string | null }[] | null) ?? [];
  result.found = due.length;

  for (const w of due) {
    try {
      const purged = await purgeWorkspace(admin, w.id);
      result.objectsRemoved += purged.objectsRemoved;
      if (!purged.ok) { result.failed++; continue; }
      result.deleted++;

      if (w.requested_by) {
        const [{ count: memberships }, { count: staff }] = await Promise.all([
          admin.from("workspace_members").select("workspace_id", { count: "exact", head: true }).eq("user_id", w.requested_by),
          admin.from("staff_members").select("user_id", { count: "exact", head: true }).eq("user_id", w.requested_by),
        ]);
        if ((memberships ?? 0) === 0 && (staff ?? 0) === 0) {
          const rm = await admin.auth.admin.deleteUser(w.requested_by);
          if (!rm.error) result.accountsRemoved++;
        }
      }
    } catch {
      result.failed++;
    }
  }
  return result;
}
