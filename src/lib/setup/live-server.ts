import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FALLBACK_LIVE, liveFromRows, type Industry } from "./types";

/** The industries open to new sign-ups. A failed read falls back to the default rather than locking anyone out. */
export async function loadLiveIndustries(supabase: SupabaseClient): Promise<readonly Industry[]> {
  const { data, error } = await supabase.from("live_industries").select("industry, live");
  if (error) return FALLBACK_LIVE;
  return liveFromRows(data as { industry: string; live: boolean }[]);
}
