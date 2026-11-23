import { cache } from "react";
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
import { TrialBanner } from "@/components/trial-banner";
import { trialDaysLeft, trialPhase } from "@/lib/billing/trial";
import { loadTrial } from "@/lib/billing/trial-server";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMyTickets } from "@/lib/support/data";
import { supportBellItems } from "@/lib/support/alerts";

/** Support requests AdFlo has replied to, for the bell. A failed read just means no support items, never a broken page. */
async function loadSupportItems(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  try { return supportBellItems(await loadMyTickets(supabase)); } catch { return []; }
}

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
 * Who is asking, worked out once per request (the layout and the page share it). It is the cheap part of the gate:
 * the validated user and their workspace. Everything the frame itself needs is loaded by the layout alone.
 */
const getAppAccess = cache(async () => {
  const env = getSupabaseEnv();
  if (!env) return { kind: "preview" as const };
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { kind: "anonymous" as const };
  const email = user.email ?? "";
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
  // Pending invites for this (verified) email take effect before the no-workspace notice is considered.
  await acceptPendingInvites(supabase, fullName);
  const membership = await findMembership(supabase, user.id);
  return { kind: "signed-in" as const, supabase, user, email, fullName, membership };
});

/**
 * Shell for every signed-in page, rendered once by `app/app/layout.tsx` and kept while the visitor moves between pages,
 * so the menu, top bar and loaded records are not rebuilt on every click. Sign-in when a database is connected,
 * otherwise an empty preview.
 */
export async function renderAppLayout(children: React.ReactNode): Promise<React.ReactNode> {
  const access = await getAppAccess();
  if (access.kind === "anonymous") redirect("/login");
  if (access.kind === "preview") {
    // No database yet: the app opens anyway, as a preview. Everything runs on records held in this
    // browser, so nothing is shared between visitors and nothing is stored on the server.
    return (
      <Frame topRight={<AppTopBar badge="Preview" notifications={await loadNotifications()} />}>
        {children}
      </Frame>
    );
  }
  const { supabase, user, email, fullName, membership } = access;
  // No workspace yet. A free trial explores the app on sample data; once it ends the account is paused until it pays, and
  // payment builds the real workspace. Anyone else new, while sign-up is open, names their company first.
  if (!membership) {
    const trial = await loadTrial();
    if (trial) {
      const phase = trialPhase(trial);
      if (phase === "expired") redirect("/trial/continue");
      if (phase === "paid" || phase === "workspace") redirect("/trial/welcome");
      const endsOn = new Date(trial.endsAt ?? Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
      return (
        <Frame userName={fullName} topRight={<AppTopBar badge="Free trial" userLabel={fullName} notifications={await loadNotifications()} />}>
          <TrialBanner daysLeft={trialDaysLeft(trial.endsAt)} endsOn={endsOn} />
          {children}
        </Frame>
      );
    }
    const { data: open } = await supabase.rpc("signup_is_open");
    if (open === true && !(await findStaff(supabase, user))) redirect("/start");
    return <NoWorkspaceNotice email={email} />;
  }
  // Everything below only needs the workspace id, so it is fetched together instead of one after another.
  const [standing, { data: ws }, { data: planFeatures }, industries, staff, supportItems, notifications] = await Promise.all([
    // A client switched off in the Control Center sees a plain notice instead of the app. Nothing is deleted.
    getWorkspaceStanding(supabase, membership.workspaceId),
    supabase.from("workspaces").select("name, deletion_requested_at").eq("id", membership.workspaceId).maybeSingle(),
    // Plan features: a failed lookup leaves everything available rather than locking a client out.
    supabase.rpc("workspace_features", { p_workspace: membership.workspaceId }),
    loadLiveIndustries(supabase),
    findStaff(supabase, user),
    loadSupportItems(supabase),
    loadNotifications(),
  ]);
  if (isPaused(standing)) return <PausedNotice standing={standing} email={email} />;
  const features = Array.isArray(planFeatures) ? (planFeatures as string[]) : null;
  // Loaded only here, so the preview never downloads the database client it does not use.
  const { RecordsProvider } = await import("@/components/records-provider");
  return (
    <Frame userName={fullName} features={features} industries={industries} wrap={(c) => <RecordsProvider workspaceId={membership.workspaceId}>{c}</RecordsProvider>} topRight={<AppTopBar workspaceName={ws?.name} userLabel={fullName} notifications={notifications} isStaff={!!staff} supportItems={supportItems} />}>
      {ws?.deletion_requested_at && <DeletionBanner requestedAt={ws.deletion_requested_at as string} />}
      {children}
    </Frame>
  );
}

/**
 * Gate for one page, inside the shared layout. `content(mode)` is only rendered once the visitor is allowed in. This runs on
 * every page visit, so it stays small: the signed-in user, their workspace and what the plan includes.
 */
export async function renderAppShell(
  nextPath: string,
  content: (mode: "live" | "preview", user?: { name: string }) => React.ReactNode,
): Promise<React.ReactNode> {
  const access = await getAppAccess();
  if (access.kind === "preview") return content("preview");
  if (access.kind === "anonymous") redirect(`/login?next=${nextPath}`);
  // Without a workspace this is the free trial's sample-data app (the layout sends everyone else elsewhere).
  if (!access.membership) return content("preview", { name: access.fullName });
  // A failed lookup leaves everything available rather than locking a client out.
  const { data: planFeatures } = await access.supabase.rpc("workspace_features", { p_workspace: access.membership.workspaceId });
  const features = Array.isArray(planFeatures) ? (planFeatures as string[]) : null;
  return pathAllowed(features, nextPath) ? content("live", { name: access.fullName }) : <NotInPlan />;
}
