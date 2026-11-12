import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app-header";
import { PlanFeaturesProvider } from "@/components/plan-features";
import { CurrentUserProvider } from "@/components/current-user";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { AppFrame } from "@/components/modules/app-frame";
import { pathAllowed } from "@/lib/control/gating";
import { dayInZone } from "@/lib/dashboard/logic";
import { acceptPendingInvites, findMembership } from "@/lib/dms/server/context";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** The visitor's day for the bell in the top bar; the bell works out its own list from the records in the browser. */
async function loadNotifications() {
  return { today: dayInZone((await headers()).get("x-vercel-ip-timezone")) };
}

function Frame({ topRight, userName, features = null, wrap, children }: { topRight: React.ReactNode; userName?: string; features?: string[] | null; wrap?: (children: React.ReactNode) => React.ReactNode; children: React.ReactNode }) {
  // A signed-in workspace saves its records to the database (`wrap` adds that); the preview keeps them in this browser.
  const body = wrap ? wrap(children) : children;
  return <PlanFeaturesProvider features={features}><AppFrame base="/app" topRight={topRight}><CurrentUserProvider name={userName}>{body}</CurrentUserProvider></AppFrame></PlanFeaturesProvider>;
}

function NotInPlan() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-panel">
      <h1 className="text-xl font-semibold tracking-tight">Not part of your plan</h1>
      <p className="mt-2 text-sm text-muted-foreground">This service is not included in your current plan. Contact Aurum Ventura to add it.</p>
    </div>
  );
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
    // Plan features: a failed lookup leaves everything available rather than locking a client out.
    const { data: planFeatures } = await supabase.rpc("workspace_features", { p_workspace: membership.workspaceId });
    const features = Array.isArray(planFeatures) ? (planFeatures as string[]) : null;
    // Loaded only here, so the preview never downloads the database client it does not use.
    const { RecordsProvider } = await import("@/components/records-provider");
    return (
      <Frame userName={fullName} features={features} wrap={(c) => <RecordsProvider workspaceId={membership.workspaceId}>{c}</RecordsProvider>} topRight={<AppTopBar workspaceName={ws?.name} userLabel={fullName} notifications={await loadNotifications()} />}>
        {pathAllowed(features, nextPath) ? content("live", { name: fullName }) : <NotInPlan />}
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
