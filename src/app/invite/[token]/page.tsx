import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { hashToken } from "@/lib/control/token";
import { isAgreementToken } from "@/lib/control/validation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { confirmInvite } from "./actions";

export const metadata: Metadata = { title: "Your invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface View { client_name: string; email: string; confirmed: boolean; expired: boolean; used: boolean }

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  let view: View | null = null;
  if (getSupabaseEnv() && isAgreementToken(token)) {
    // The database hashes nothing itself: only the hash of the secret in the link is ever looked up.
    const { data } = await (await createServerSupabase()).rpc("invite_public_view", { p_token_hash: hashToken(token) });
    view = ((data ?? []) as View[])[0] ?? null;
  }

  if (!view) return <AuthCard title="This link is not valid" subtitle="It may have been replaced by a newer one."><p className="text-sm text-muted-foreground">Open the most recent invitation email from AdFlo, or ask AdFlo to send you a new one.</p></AuthCard>;
  if (view.used) return <AuthCard title="Your account is already set up" subtitle={view.client_name}><Button asChild className="w-full"><Link href="/login">Log in</Link></Button></AuthCard>;
  if (view.expired) return <AuthCard title="This invitation has expired" subtitle={view.client_name}><p role="alert" className="text-sm text-muted-foreground">Ask AdFlo to send you a new invitation.</p></AuthCard>;
  if (view.confirmed) return (
    <AuthCard title="Invitation confirmed" subtitle={`You are invited to AdFlo for ${view.client_name}.`}>
      <p className="mb-4 text-sm text-muted-foreground">Next, create your account with <strong className="text-foreground">{view.email}</strong>.</p>
      <Button asChild className="w-full"><Link href={`/signup?email=${encodeURIComponent(view.email)}`}>Create your account</Link></Button>
    </AuthCard>
  );
  return (
    <AuthCard title="Confirm your invitation" subtitle={`You are invited to AdFlo for ${view.client_name}.`}>
      <p className="mb-4 text-sm text-muted-foreground">Confirm that this invitation is for <strong className="text-foreground">{view.email}</strong>. Then you can create your account.</p>
      <form action={confirmInvite.bind(null, token)}><Button type="submit" size="lg" className="w-full">Confirm invitation</Button></form>
    </AuthCard>
  );
}
