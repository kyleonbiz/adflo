import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { ModuleNav } from "@/components/modules/module-nav";
import { acceptPendingInvites, findMembership } from "@/lib/dms/server/context";
import { devModeAllowed, getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

function Frame({ active, header, children }: { active: string; header: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {header}
      <ModuleNav base="/app" active={active} />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">{children}</main>
    </div>
  );
}

/**
 * Shared gate for every signed-in page: sign-in, workspace onboarding, the "not configured" refusal in
 * production, and development mode. `content(mode)` is only rendered once the visitor is allowed in.
 */
export async function renderAppShell(
  active: string,
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
      <Frame active={active} header={<AppHeader workspaceName={ws?.name} userLabel={email} />}>
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
    <Frame active={active} header={<AppHeader badge="Development mode" />}>
      {content("dev")}
    </Frame>
  );
}
