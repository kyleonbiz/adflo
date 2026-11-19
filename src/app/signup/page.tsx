import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { email } = await searchParams;
  // Arrives from the confirmed invitation: the invited email is filled in and cannot be changed, because only it will work.
  const invited = typeof email === "string" && email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email) ? email : undefined;
  return (
    <AuthCard title="Create your account" subtitle={invited ? "Your invitation is confirmed. Choose a password." : "Sign-up is by invitation. Open the link in your invitation email and confirm it first."}>
      <AuthForm mode="signup" demo={!getSupabaseEnv()} invitedEmail={invited} />
    </AuthCard>
  );
}
