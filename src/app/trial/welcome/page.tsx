import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { loadTrial } from "@/lib/billing/trial-server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Setting up your workspace" };
export const dynamic = "force-dynamic";

/**
 * Where Stripe sends someone after paying. Stripe tells our server about the payment a moment later, so until it has, this page
 * refreshes itself. Once the payment is confirmed it creates the real workspace and opens the app.
 */
export default async function WelcomePage() {
  if (!getSupabaseEnv()) redirect("/app/overview");
  const { data } = await (await createServerSupabase()).auth.getUser();
  if (!data.user) redirect("/login?next=/trial/welcome");
  const trial = await loadTrial();
  if (!trial || trial.hasWorkspace) redirect("/app/help?billing=success"); // an existing workspace subscribing: back to billing
  if (trial.paid) {
    const admin = createServiceSupabase();
    const { error } = admin ? await admin.rpc("activate_trial_workspace", { p_client: trial.clientId, p_user: data.user.id }) : { error: { message: "no service role" } };
    if (!error) redirect("/app/overview");
  }
  return (
    <AuthCard title="Setting up your workspace" subtitle={trial.company}>
      <meta httpEquiv="refresh" content="3" />
      <p className="text-sm text-muted-foreground">Thank you. We are confirming your payment and building your workspace. This page refreshes on its own and takes you in as soon as it is ready.</p>
      <p className="mt-3 text-sm text-muted-foreground">Still here after a minute? Email <a href="mailto:support@adflo.pro" className="font-medium text-primary hover:underline">support@adflo.pro</a>.</p>
    </AuthCard>
  );
}
