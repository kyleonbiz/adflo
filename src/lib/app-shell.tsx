import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app-header";
import { PlanFeaturesProvider } from "@/components/plan-features";
import { CurrentUserProvider } from "@/components/current-user";
import { NoWorkspaceNotice } from "@/components/auth/no-workspace-notice";
import { AppFrame } from "@/components/modules/app-frame";
import { pathAllowed } from "@/lib/control/gating";
import { dayInZone } from "@/lib/dashboard/logic";
import { PausedNotice } from "@/components/auth/paused-notice";
import { acceptPendingInvites, findMembership, getWorkspaceStanding } from "@/lib/dms/server/context";
import { isPaused } from "@/lib/dms/standing";
import { DocLetterhead } from "@/components/forms/doc-letterhead";
import { LiveIndustries } from "@/components/live-industries";
import { loadLiveIndustries } from "@/lib/setup/live-server";
import { FALLBACK_LIVE } from "@/lib/setup/types";
import { DeletionBanner } from "@/components/settings/deletion-banner";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { findStaff } from "@/lib/control/gate";
import { createServerSupabase } from "@/lib/supabase/server";

/** The visitor's day for the bell in the top bar; the bell works out its own list from the records in the browser. */
async function loadNotifications() {
  return { today: dayInZone((await headers()).get("x-vercel-ip-timezone")) };
}

function Frame({ topRight, userName, features = null, industries = FALLBACK_LIVE, wrap, children }: { topRight: React.ReactNode; userName?: string; features?: string[] | null; industries?: typeof FALLBACK_LIVE; wrap?: (children: React.ReactNode) => React.ReactNode; children: React.ReactNode }) {
  // A signed-in workspace saves its records to the database (`wrap` adds that); the preview keeps them in this browser.
  const sync = <><DocLetterhead />{children}</>;
  const body = wrap ? wrap(sync) : sync;
  return <PlanFeaturesProvider features={features}><LiveIndustries industries={industries}><AppFrame base="/app" topRight={topRight}><CurrentUserProvider name={userName}>{body}</CurrentUserProvider></AppFrame></LiveIndustries></PlanFeaturesProvider>;
}

function NotInPlan() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-panel">
      <h1 className="text-xl font-semibold tracking-tight">Not part of your plan</h1>
      <p className="mt-2 text-sm text-muted-foreground">This service is not included in your current plan. Contact AdFlo to add it.</p>
    </div>
  );
}

/**
 * Shared gate for every signed-in page: sign-in when a database is connected,
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
    // Pending invites for this (verified) email take effect before the no-workspace notice is considered.
    await acceptPendingInvites(supabase, fullName);
    const membership = await findMembership(supabase, data.user.id);
    // No workspace yet: while sign-up is open a new account sets up its own company; staff and closed sign-up see the notice.
    if (!membership) {
      const { data: open } = await supabase.rpc("signup_is_open");
      if (open === true && !(await findStaff(supabase))) redirect("/start");
      return <NoWorkspaceNotice email={email} />;
    }
    // A client switched off in the Control Center sees a plain notice instead of the app. Nothing is deleted.
    const standing = await getWorkspaceStanding(supabase, membership.workspaceId);
    if (isPaused(standing)) return <PausedNotice standing={standing} email={email} />;
    const { data: ws } = await supabase.from("workspaces").select("name, deletion_requested_at").eq("id", membership.workspaceId).maybeSingle();
    // Plan features: a failed lookup leaves everything available rather than locking a client out.
    const { data: planFeatures } = await supabase.rpc("workspace_features", { p_workspace: membership.workspaceId });
    const features = Array.isArray(planFeatures) ? (planFeatures as string[]) : null;
    // Loaded only here, so the preview never downloads the database client it does not use.
    const { RecordsProvider } = await import("@/components/records-provider");
    return (
      <Frame userName={fullName} features={features} industries={await loadLiveIndustries(supabase)} wrap={(c) => <RecordsProvider workspaceId={membership.workspaceId}>{c}</RecordsProvider>} topRight={<AppTopBar workspaceName={ws?.name} userLabel={fullName} notifications={await loadNotifications()} isStaff={!!(await findStaff(supabase))} />}>
        {ws?.deletion_requested_at && <DeletionBanner requestedAt={ws.deletion_requested_at as string} />}
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
