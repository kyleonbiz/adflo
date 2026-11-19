import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { email } = await searchParams;
  // Arrives from the confirmed invitation: the invited email is filled in and cannot be changed, because only it will work.
  const invited = typeof email === "string" && email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email) ? email : undefined;

  // Already signed in as someone else (the browser still holds another account): that account would open the app with no
  // workspace for it, so say so and offer to sign out and come straight back here.
  if (invited && getSupabaseEnv()) {
    const { data } = await (await createServerSupabase()).auth.getUser();
    const current = data.user?.email;
    if (current && current.toLowerCase() !== invited.toLowerCase()) {
      return (
        <AuthCard title="Sign out to continue" subtitle={`This browser is signed in as ${current}.`}>
          <p className="mb-4 text-sm text-muted-foreground">Your invitation is for <strong className="text-foreground">{invited}</strong>. Sign out of {current}, and you will come straight back here to create that account. A private window works too.</p>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value={`/signup?email=${encodeURIComponent(invited)}`} />
            <Button type="submit" size="lg" className="w-full"><LogOut /> Sign out and continue</Button>
          </form>
        </AuthCard>
      );
    }
  }

  return (
    <AuthCard title="Create your account" subtitle={invited ? "Your invitation is confirmed. Choose a password." : "Sign-up is by invitation. Open the link in your invitation email and confirm it first."}>
      <AuthForm mode="signup" demo={!getSupabaseEnv()} invitedEmail={invited} />
    </AuthCard>
  );
}
