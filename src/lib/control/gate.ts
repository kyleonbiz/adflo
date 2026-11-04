import "server-only";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { devModeAllowed, getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { STAFF_ROLES, type StaffRole } from "./types";

export interface Staff { userId: string; name: string; email: string; role: StaffRole }

/** The signed-in user's active staff row, or null. Clients are never staff, and RLS hides this table from them anyway. */
export async function findStaff(supabase: SupabaseClient): Promise<Staff | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("staff_members").select("role, display_name, email, active").eq("user_id", auth.user.id).maybeSingle();
  if (!data || !data.active || !STAFF_ROLES.includes(data.role as StaffRole)) return null;
  const email = (data.email as string) || auth.user.email || "";
  return { userId: auth.user.id, name: (data.display_name as string) || email.split("@")[0], email, role: data.role as StaffRole };
}

export type ControlAccess = { mode: "live"; staff: Staff; supabase: SupabaseClient } | { mode: "preview" };

/**
 * Gate for every Control Center page. With a database: sign in, then be active staff, otherwise the page does
 * not exist (404, so its presence is not revealed). Without a database it opens as an empty preview, but only in
 * development; a production build without a database shows nothing.
 */
export async function requireStaff(nextPath: string): Promise<ControlAccess> {
  if (getSupabaseEnv()) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect(`/login?next=${nextPath}`);
    const staff = await findStaff(supabase);
    if (!staff) notFound();
    return { mode: "live", staff, supabase };
  }
  if (devModeAllowed()) return { mode: "preview" };
  notFound();
}
