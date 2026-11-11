import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your email and we will send you a link to choose a new one.">
      {getSupabaseEnv() ? (
        <ForgotPasswordForm />
      ) : (
        <p className="text-sm text-muted-foreground">Password reset is not available in this demo.</p>
      )}
    </AuthCard>
  );
}
