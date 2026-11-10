import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyForm } from "@/components/control/mfa-form";
import { requireStaff } from "@/lib/control/gate";

export const metadata: Metadata = { title: "Staff sign-in" };
export const dynamic = "force-dynamic";

export default async function VerifyRoute({ searchParams }: PageProps<"/control/verify">) {
  const access = await requireStaff("/control/verify", { allowPasswordOnly: true });
  if (access.mode === "preview") redirect("/control");
  const { next } = await searchParams;
  return (
    <AuthCard title="Two-factor sign-in" subtitle="Enter the code from your authenticator app to open the Control center.">
      <VerifyForm next={Array.isArray(next) ? next[0] : (next ?? "/control")} />
    </AuthCard>
  );
}
