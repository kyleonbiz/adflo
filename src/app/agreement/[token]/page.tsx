import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { AcceptForm } from "@/components/control/agreement-accept";
import { hashToken } from "@/lib/control/token";
import { isAgreementToken } from "@/lib/control/validation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agreement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface View { title: string; version: number; body: string; client_name: string; accepted_at: string | null; accepted_name: string | null; expired: boolean }

export default async function AgreementPage({ params }: PageProps<"/agreement/[token]">) {
  const { token } = await params;
  let view: View | null = null;
  if (getSupabaseEnv() && isAgreementToken(token)) {
    const { data } = await (await createServerSupabase()).rpc("agreement_public_view", { p_token_hash: hashToken(token) });
    view = ((data ?? []) as View[])[0] ?? null;
  }
  return (
    <div className="hero-gradient min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <Brand wordmark light className="w-44" />
        <main className="space-y-5 rounded-2xl bg-card p-6 shadow-float sm:p-8">
          {!view ? (
            <><h1 className="text-xl font-semibold tracking-tight">This link is not valid</h1><p className="text-sm text-muted-foreground">Check that you opened the whole link, or ask AdFlo to send you a new one.</p></>
          ) : (
            <>
              <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prepared for {view.client_name}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{view.title}</h1><p className="text-xs text-muted-foreground">Version {view.version}</p></div>
              <article className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-background p-4 text-sm leading-relaxed" tabIndex={0} aria-label="Agreement text">{view.body}</article>
              {view.accepted_at ? (
                <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Accepted by {view.accepted_name} on {new Date(view.accepted_at).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}.</p>
              ) : view.expired ? (
                <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">This link has expired. Ask AdFlo to send you a new one.</p>
              ) : (
                <AcceptForm token={token} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
