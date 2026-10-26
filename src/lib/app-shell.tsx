import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app-header";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { AppFrame } from "@/components/modules/app-frame";
import { loadDashboardSources } from "@/lib/dashboard/data";
import { buildDashboard, dayInZone } from "@/lib/dashboard/logic";
import { acceptPendingInvites, findMembership } from "@/lib/dms/server/context";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** The same attention list as the dashboard, for the bell in the top bar. */
async function loadNotifications() {
  const today = dayInZone((await headers()).get("x-vercel-ip-timezone"));
  return { items: buildDashboard(await loadDashboardSources(), today).items, today };
}

function Frame({ topRight, children }: { topRight: React.ReactNode; children: React.ReactNode }) {
  return <AppFrame base="/app" topRight={topRight}>{children}</AppFrame>;
}

/**
 * Shared gate for every signed-in page: sign-in and workspace onboarding when a database is connected,
 * otherwise an empty preview. `content(mode)` is only rendered once the visitor is allowed in.
 */
export async function renderAppShell(
  nextPath: string,
  content: (mode: "live" | "preview", user?: { name: string }) => React.ReactNode,
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
      <Frame topRight={<AppTopBar workspaceName={ws?.name} userLabel={email} notifications={await loadNotifications()} />}>
        {content("live", { name: fullName })}
      </Frame>
    );
  }

  // No database yet: the app opens anyway, as a preview. Everything runs on records held in this
  // browser, so nothing is shared between visitors and nothing is stored on the server.
  return (
    <Frame topRight={<AppTopBar badge="Preview" notifications={await loadNotifications()} />}>
      {content("preview")}
    </Frame>
  );
}
