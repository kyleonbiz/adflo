import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthCard title="Create your account" subtitle="Start organizing documents securely.">
      {getSupabaseEnv() ? (
        <>
          <AuthForm mode="signup" />
          <p className="mt-3 text-xs text-muted-foreground">By creating an account you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign-up is not available in this demo. Open the app to look around; your work is saved in this browser.
        </p>
      )}
    </AuthCard>
  );
}
