import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app-header";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { AppFrame } from "@/components/modules/app-frame";
import { acceptPendingInvites, findMembership } from "@/lib/dms/server/context";
import { devModeAllowed, getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

function Frame({ topRight, children }: { topRight: React.ReactNode; children: React.ReactNode }) {
  return <AppFrame base="/app" topRight={topRight}>{children}</AppFrame>;
}

/**
 * Shared gate for every signed-in page: sign-in, workspace onboarding, the "not configured" refusal in
 * production, and development mode. `content(mode)` is only rendered once the visitor is allowed in.
 */
export async function renderAppShell(
  nextPath: string,
  content: (mode: "live" | "dev") => React.ReactNode,
): Promise<React.ReactNode> {
  if (getSupabaseEnv()) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect(`/login?next=${nextPath}`);
    const email = data.user.email ?? "";
    const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
    // Pending invites for this (verified) email take effect before onboarding is offered.
    await acceptPendingInvites(supabase, fullName);
    const membership = await findMembership(supabase, data.user.id);
    if (!membership) {
      return (
        <AuthCard title="Create your workspace" subtitle="A workspace holds your team's documents, folders and storage.">
          <OnboardingForm displayName={fullName} email={email} />
        </AuthCard>
      );
    }
    const { data: ws } = await supabase.from("workspaces").select("name").eq("id", membership.workspaceId).maybeSingle();
    return (
      <Frame topRight={<AppTopBar workspaceName={ws?.name} userLabel={email} />}>
        {content("live")}
      </Frame>
    );
  }

  if (!devModeAllowed()) {
    return (
      <AuthCard title="Not configured" subtitle="This deployment has no database connected.">
        <p className="text-sm text-muted-foreground">
          Set the Supabase environment variables described in the README. Development mode is disabled in production.
        </p>
      </AuthCard>
    );
  }
  return (
    <Frame topRight={<AppTopBar badge="Development mode" />}>
      {content("dev")}
    </Frame>
  );
}
