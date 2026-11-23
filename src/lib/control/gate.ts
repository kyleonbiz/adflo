import "server-only";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { controlDemoActive, devModeAllowed, getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { staffLoginHref } from "./login";
import { STAFF_ROLES, type StaffRole } from "./types";

export interface Staff { userId: string; name: string; email: string; role: StaffRole }

/** The signed-in user's active staff row, or null. Clients are never staff, and RLS hides this table from them anyway. */
export async function findStaff(supabase: SupabaseClient, known?: { id: string; email?: string | null }): Promise<Staff | null> {
  // A caller that has just validated the user passes it in, which saves a round trip to the auth server.
  const user = known ?? (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data } = await supabase.from("staff_members").select("role, display_name, email, active").eq("user_id", user.id).maybeSingle();
  if (!data || !data.active || !STAFF_ROLES.includes(data.role as StaffRole)) return null;
  const email = (data.email as string) || user.email || "";
  return { userId: user.id, name: (data.display_name as string) || email.split("@")[0], email, role: data.role as StaffRole };
}

/**
 * Demo switch for trying the screens before the database is set up: set CONTROL_DEMO=true on the server (e.g. in Vercel).
 * Off unless set. When on, /control opens without sign-in and shows only the built-in sample data; it never reads or
 * writes the database, and every change request is refused. It only applies while no database is configured: once Supabase
 * is connected the variable is ignored. Still remove it before real clients use the app.
 */
export const controlDemoEnabled = controlDemoActive;

type ControlAccess = { mode: "live"; staff: Staff; supabase: SupabaseClient } | { mode: "preview" };

/**
 * Gate for every Control center page. With a database: sign in, then be active staff, otherwise the page does
 * not exist (404, so its presence is not revealed). Without a database it opens as an empty preview, but only in
 * development; a production build without a database shows nothing.
 */
export async function requireStaff(nextPath: string, opts: { allowPasswordOnly?: boolean } = {}): Promise<ControlAccess> {
  if (controlDemoEnabled()) return { mode: "preview" };
  if (getSupabaseEnv()) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect(staffLoginHref(nextPath));
    const staff = await findStaff(supabase);
    if (!staff) notFound();
    if (!opts.allowPasswordOnly) {
      // Staff data needs a second factor (the database enforces it too). No factor yet: set one up. Has one: enter the code.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2") redirect(aal?.nextLevel === "aal2" ? `/control/verify?next=${encodeURIComponent(nextPath)}` : "/control/security");
    }
    return { mode: "live", staff, supabase };
  }
  if (devModeAllowed()) return { mode: "preview" };
  notFound();
}
