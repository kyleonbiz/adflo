import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { CheckoutPanel } from "@/components/checkout-panel";
import { Button } from "@/components/ui/button";
import { trialPhase } from "@/lib/billing/trial";
import { loadTrial } from "@/lib/billing/trial-server";

export const metadata: Metadata = { title: "Continue with AdFlo" };
export const dynamic = "force-dynamic";

/** Pay to continue: shown when a free trial has ended (the account is paused), or any time the trial owner chooses to subscribe early. */
export default async function ContinuePage() {
  const trial = await loadTrial();
  if (!trial) redirect("/app/overview");
  const phase = trialPhase(trial);
  if (phase === "workspace") redirect("/app/overview");
  if (phase === "paid") redirect("/trial/welcome");
  return (
    <AuthCard title={phase === "expired" ? "Your free trial has ended" : "Continue with AdFlo"} subtitle={trial.company}>
      <CheckoutPanel expired={phase === "expired"} />
      <div className="mt-5 flex items-center justify-between text-sm">
        {phase === "trial" ? <a href="/app/overview" className="font-medium text-primary hover:underline">Back to the trial</a> : <span />}
        <form action="/auth/signout" method="post"><Button type="submit" variant="ghost" size="sm"><LogOut /> Sign out</Button></form>
      </div>
    </AuthCard>
  );
}
