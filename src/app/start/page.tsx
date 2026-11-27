import { TRIAL_DAYS } from "@/lib/billing/trial";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { NoWorkspaceNotice } from "@/components/auth/no-workspace-notice";
import { StartForm } from "@/components/auth/start-form";
import { findStaff } from "@/lib/control/gate";
import { acceptPendingInvites, findMembership } from "@/lib/dms/server/context";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your company" };
export const dynamic = "force-dynamic";

/** Where a new account lands after confirming its email: name the company, then open the trial (sample data, no workspace). */
export default async function StartPage() {
  if (!getSupabaseEnv()) redirect("/app/overview");
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/start");
  const email = data.user.email ?? "";
  const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
  // An invitation for this email takes effect first: invited people join their company's workspace instead of starting one.
  await acceptPendingInvites(supabase, fullName);
  if (await findMembership(supabase, data.user.id)) redirect("/app/overview");
  const { data: trial } = await supabase.rpc("my_trial");
  if (Array.isArray(trial) && trial.length > 0) redirect("/app/overview"); // already has a trial
  const { data: open } = await supabase.rpc("signup_is_open");
  if (open !== true || (await findStaff(supabase))) return <NoWorkspaceNotice email={email} />;
  return (
    <AuthCard title="Set up your company" subtitle={`Two quick questions, then explore AdFlo free for ${TRIAL_DAYS} days. No card needed.`}>
      <StartForm defaultName={fullName} />
    </AuthCard>
  );
}
