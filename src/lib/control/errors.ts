import "server-only";
import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * Records that something failed, for the Control center's error log. Stores only the error class, where it happened and
 * (when known) the workspace; never the message, which can contain file names or client data. Best effort: it must never
 * throw or slow a failing request, and does nothing without a database and a service key.
 */
export async function logAppError(source: string, e: unknown, opts: { status?: number; workspaceId?: string; userId?: string } = {}): Promise<void> {
  try {
    const db = createServiceSupabase();
    if (!db) return;
    let workspaceId = opts.workspaceId ?? null;
    if (!workspaceId && opts.userId) {
      // Which workspace the signed-in person belongs to, so the error can be tied to that client.
      const { data } = await db.from("workspace_members").select("workspace_id").eq("user_id", opts.userId).limit(1).maybeSingle();
      workspaceId = (data?.workspace_id as string | undefined) ?? null;
    }
    const kind = e instanceof Error ? e.name || "Error" : typeof e;
    await db.from("app_errors").insert({
      source: source.slice(0, 80), kind: kind.slice(0, 80), status: opts.status ?? null, workspace_id: workspaceId,
    });
  } catch {
    // Logging is never allowed to cause a second failure.
  }
}
