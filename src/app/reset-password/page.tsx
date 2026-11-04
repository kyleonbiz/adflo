import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/control/reset-password-form";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" subtitle="Enter the password you want to use for AdFlo.">
      {getSupabaseEnv() ? <ResetPasswordForm /> : <p className="text-sm text-muted-foreground">Sign-in is not configured here.</p>}
    </AuthCard>
  );
}
