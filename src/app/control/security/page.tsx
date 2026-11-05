import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { EnrollForm } from "@/components/control/mfa-form";
import { requireStaff } from "@/lib/control/gate";

export const metadata: Metadata = { title: "Set up two-factor" };
export const dynamic = "force-dynamic";

export default async function SecurityRoute() {
  const access = await requireStaff("/control/security", { allowPasswordOnly: true });
  if (access.mode === "preview") redirect("/control");
  // Already has a factor: ask for the code instead of enrolling a second one.
  const { data: aal } = await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/control");
  if (aal?.nextLevel === "aal2") redirect("/control/verify");
  return (
    <AuthCard title="Set up two-factor" subtitle="Staff accounts can reach every client, so a second step is required.">
      <EnrollForm />
    </AuthCard>
  );
}
