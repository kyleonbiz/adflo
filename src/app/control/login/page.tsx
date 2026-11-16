import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { StaffLoginForm } from "@/components/control/staff-login-form";
import { Button } from "@/components/ui/button";
import { controlDemoActive, getSupabaseEnv } from "@/lib/supabase/env";
import { findStaff } from "@/lib/control/gate";
import { staffNext } from "@/lib/control/login";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Sign-in for AdFlo's own staff, separate from the client login. */
export default async function StaffLoginPage({ searchParams }: PageProps<"/control/login">) {
  const { next } = await searchParams;
  const target = staffNext(typeof next === "string" ? next : undefined);

  // No database (the demo or a development preview): there is nobody to sign in, so open the Control center.
  if (!getSupabaseEnv() || controlDemoActive()) redirect(target);

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    // Already signed in as staff: carry on (the Control center asks for the two-factor code if it is needed).
    if (await findStaff(supabase)) redirect(target);
    // Signed in, but not as staff: say so plainly instead of showing a dead end.
    return (
      <AuthCard title="This is not a staff account" subtitle={`Signed in as ${data.user.email ?? "this account"}`}>
        <p className="text-sm text-muted-foreground">The Control center is for AdFlo staff. Sign out, then sign in with your staff email.</p>
        <form action="/auth/signout" method="post" className="mt-5">
          <input type="hidden" name="to" value="control" />
          <Button type="submit" variant="outline"><LogOut /> Sign out</Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Staff sign-in" subtitle="AdFlo Control center. For AdFlo staff only.">
      <StaffLoginForm next={target} />
    </AuthCard>
  );
}
