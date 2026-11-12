import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { AgreementText } from "@/components/control/agreement-text";
import { AcceptForm } from "@/components/control/agreement-accept";
import { fakeAgreementView, isFakeAgreement } from "@/lib/control/fake-agreement";
import { isAgreementToken } from "@/lib/control/validation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agreement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface View { title: string; version: number; body: string; client_name: string; accepted_at: string | null; accepted_name: string | null; expired: boolean }

export default async function AgreementPage({ params }: PageProps<"/agreement/[token]">) {
  const { token } = await params;
  let view: View | null = null;
  if (isFakeAgreement(token)) view = fakeAgreementView();
  else if (getSupabaseEnv() && isAgreementToken(token)) {
    // The database hashes the secret itself, so the stored hash is never a usable credential.
    const { data } = await (await createServerSupabase()).rpc("agreement_public_view", { p_token: token });
    view = ((data ?? []) as View[])[0] ?? null;
  }
  return (
    <div className="hero-gradient min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Brand wordmark light className="mx-auto mb-6 w-56" />
        <main className="page-rise">
          <div className="space-y-5">
            {!view ? (
              <section className="rounded-2xl bg-card p-6 shadow-float sm:p-8"><h1 className="text-xl font-semibold tracking-tight">This link is not valid</h1><p className="mt-1 text-sm text-muted-foreground">Check that you opened the whole link, or ask AdFlo to send you a new one.</p></section>
            ) : (
              <>
                <section className="rounded-2xl bg-card p-6 shadow-float sm:p-8" aria-label="Agreement text">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prepared for {view.client_name}</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">{view.title}</h1>
                  <p className="mb-4 text-sm text-muted-foreground">Version {view.version}</p>
                  <article className="max-h-[32rem] overflow-y-auto rounded-xl bg-muted p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0}><AgreementText body={view.body} /></article>
                </section>
                <section className="rounded-2xl bg-card p-6 shadow-float sm:p-8" aria-label="Acceptance">
                  <h2 className="mb-4 text-lg font-semibold tracking-tight">Your acceptance</h2>
                  {view.accepted_at ? (
                    <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Accepted by {view.accepted_name} on {new Date(view.accepted_at).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}.</p>
                  ) : view.expired ? (
                    <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">This link has expired. Ask AdFlo to send you a new one.</p>
                  ) : (
                    <AcceptForm token={token} />
                  )}
                </section>
              </>
            )}
          </div>
        </main>
        <p className="mt-6 text-center text-xs text-slate-400">Aurum Ventura Enterprise LLC · AdFlo</p>
      </div>
    </div>
  );
}
