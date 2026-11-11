import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <AuthCard title="Log in to your account" subtitle="Access your AdFlo workspace.">
      {getSupabaseEnv() ? (
        <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign-in is not available in this demo. Open the app to look around; your work is saved in this browser.
        </p>
      )}
    </AuthCard>
  );
}
