import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <AuthCard title="Log in to your account" subtitle="Access your AdFlo workspace.">
      <AuthForm mode="login" next={typeof next === "string" ? next : undefined} demo={!getSupabaseEnv()} />
    </AuthCard>
  );
}
