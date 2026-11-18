import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthCard title="Create your account" subtitle="Sign-up is by invitation. Use the email address your invitation was sent to.">
      <AuthForm mode="signup" demo={!getSupabaseEnv()} />
    </AuthCard>
  );
}
