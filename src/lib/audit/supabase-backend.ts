import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_ENTRIES, parseAudit, type AuditEntry } from "./logic";
import { ActivityDenied, type ActivityBackend } from "./remote";

type Failure = { code?: string; message?: string } | null;

/** Turns a database error into "not allowed" (a viewer; never retry) or "try again" (anything else). */
function check(error: Failure): void {
  if (!error) return;
  const denied = error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "");
  if (denied) throw new ActivityDenied();
  throw new Error("failed");
}

/**
 * Keeps the activity trail in `workspace_activity`, under the signed-in user's own access. The table is append-only,
 * and the database sets the time, the person and the name of every line, so none of them can be faked from here.
 */
export function createActivityBackend(client: SupabaseClient, workspaceId: string): ActivityBackend {
  return {
    async load() {
      const { data, error } = await client.from("workspace_activity").select("id, at, data")
        .eq("workspace_id", workspaceId)
        .order("at", { ascending: false }).order("id", { ascending: false })
        .limit(MAX_ENTRIES);
      if (error) throw new Error("failed");
      const lines = (data ?? []).map((row) => ({ ...(row.data as Record<string, unknown>), id: row.id as string, at: row.at as string }));
      // The same checks the browser's copy gets: a line that is not shaped like one is left out.
      return parseAudit(JSON.stringify(lines));
    },

    async append(entry: AuditEntry) {
      // Only what was done is sent. The time, the person and the name are the database's to say.
      const { error } = await client.from("workspace_activity").upsert(
        { workspace_id: workspaceId, id: entry.id, data: { verb: entry.verb, what: entry.what, area: entry.area, href: entry.href } },
        { onConflict: "workspace_id,id", ignoreDuplicates: true },
      );
      check(error);
    },
  };
}
