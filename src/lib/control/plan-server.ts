import "server-only";
import { findMembership } from "@/lib/dms/server/context";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasFeature, type FeatureKey } from "./tiers";

/**
 * Whether the signed-in user's plan includes a feature, for API routes. It answers yes whenever it cannot tell
 * (no database, not signed in, no workspace, a legacy plan, a failed lookup): a plan never locks anyone out by accident.
 */
export async function planIncludes(key: FeatureKey): Promise<boolean> {
  if (!getSupabaseEnv()) return true;
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return true;
    const membership = await findMembership(supabase, data.user.id);
    if (!membership) return true;
    const { data: features } = await supabase.rpc("workspace_features", { p_workspace: membership.workspaceId });
    return hasFeature(Array.isArray(features) ? (features as string[]) : null, key);
  } catch {
    return true;
  }
}
