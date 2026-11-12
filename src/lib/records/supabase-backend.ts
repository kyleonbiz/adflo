import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rec } from "./diff";
import { RecordsSyncError, type RecordsBackend } from "./remote";

/** The services saved to the database so far. The rest still live in the browser (see `storage.ts`). */
export const PERSISTED_KINDS = ["licenses", "projects"] as const;

const PAGE = 1000; // the database returns at most this many rows per request
const CHUNK = 200;

type Failure = { code?: string; message?: string } | null;
/** Turns a database error into "not allowed" (a viewer) or "try again" (anything else). */
function check(error: Failure): void {
  if (!error) return;
  const denied = error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "");
  throw new RecordsSyncError(denied ? "denied" : "failed");
}

/** Saves records as one row each in `workspace_records`, under the signed-in user's own access (the database enforces who may write). */
export function createSupabaseBackend(client: SupabaseClient, workspaceId: string): RecordsBackend {
  return {
    async load(kind) {
      const records: Rec[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client.from("workspace_records").select("id, data")
          .eq("workspace_id", workspaceId).eq("kind", kind).order("id").range(from, from + PAGE - 1);
        check(error);
        for (const row of data ?? []) records.push({ ...(row.data as Record<string, unknown>), id: row.id as string });
        if (!data || data.length < PAGE) break;
      }
      const { data: set, error } = await client.from("workspace_record_sets").select("kind")
        .eq("workspace_id", workspaceId).eq("kind", kind).maybeSingle();
      check(error);
      return { records, saved: !!set || records.length > 0 };
    },

    async save(kind, { upserts, deletes, markSaved }) {
      for (let i = 0; i < upserts.length; i += CHUNK) {
        const rows = upserts.slice(i, i + CHUNK).map((r) => ({ workspace_id: workspaceId, kind, id: r.id, data: r }));
        const { error } = await client.from("workspace_records").upsert(rows, { onConflict: "workspace_id,kind,id" });
        check(error);
      }
      for (let i = 0; i < deletes.length; i += CHUNK) {
        const { error } = await client.from("workspace_records").delete()
          .eq("workspace_id", workspaceId).eq("kind", kind).in("id", deletes.slice(i, i + CHUNK));
        check(error);
      }
      if (markSaved) {
        const { error } = await client.from("workspace_record_sets")
          .upsert({ workspace_id: workspaceId, kind }, { onConflict: "workspace_id,kind", ignoreDuplicates: true });
        check(error);
      }
    },
  };
}
