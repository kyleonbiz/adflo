import "server-only";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TrialInfo } from "./trial";

/** The signed-in person's self-serve trial, or null when they have none (or no database is connected). */
export async function loadTrial(): Promise<TrialInfo | null> {
  if (!getSupabaseEnv()) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("my_trial");
  const r = (Array.isArray(data) ? data[0] : null) as { client_id: string; company: string; trial_ends_at: string | null; paid: boolean; has_workspace: boolean } | null;
  return r ? { clientId: r.client_id, company: r.company, endsAt: r.trial_ends_at, paid: r.paid, hasWorkspace: r.has_workspace } : null;
}
