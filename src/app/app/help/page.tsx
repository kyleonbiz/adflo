import type { Metadata } from "next";
import Link from "next/link";
import { renderAppShell } from "@/lib/app-shell";
import { SupportRequests, type MyRequest } from "@/components/help/support-requests";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Help & Training" };
export const dynamic = "force-dynamic";

const TIPS = [
  "Press the + Add button in the menu to create a document, invoice, contact or task from anywhere.",
  "Star a document to protect it: starred documents cannot be deleted until you remove the star.",
  "Deleted documents wait in Trash. Open Trash and choose Empty trash to remove them for good.",
  "Use Send on a document, form or report to email it or copy a link.",
];

/** The signed-in person's own requests, newest first. Empty if the lookup fails: the form still works. */
async function loadMyRequests(): Promise<MyRequest[]> {
  if (!getSupabaseEnv()) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("workspace_my_tickets");
  return ((data ?? []) as { id: string; subject: string; body: string; status: MyRequest["status"]; created_at: string; replies: number | string }[]).map((t) => ({ id: t.id, subject: t.subject, body: t.body, status: t.status, createdAt: t.created_at, replies: Number(t.replies) }));
}

export default function HelpRoute() {
  return renderAppShell("/app/help", async (mode) => {
    const requests = mode === "live" ? await loadMyRequests() : [];
    return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help &amp; Training</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quick guides for each part of AdFlo. For anything else, contact support below or email support@adflo.pro.</p>
      </div>
      <section aria-label="Tips" className="rounded-2xl border bg-card p-6 shadow-panel">
        <h2 className="text-base font-semibold">Good to know</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
      {mode === "live" ? <SupportRequests requests={requests} /> : (
        <section aria-label="Contact support" className="rounded-2xl border bg-card p-6 shadow-panel">
          <h2 className="text-base font-semibold">Contact support</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to send a request from here. Until then, email <a href="mailto:support@adflo.pro" className="font-medium text-primary hover:underline">support@adflo.pro</a>.</p>
        </section>
      )}
      <section aria-label="Modules" className="rounded-2xl border bg-card p-6 shadow-panel">
        <h2 className="text-base font-semibold">What each service does</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {MODULES.filter((m) => !m.hidden).map((m) => {
            const href = moduleHref(m, "/app");
            return (
              <li key={m.id}>
                {href ? <Link href={href} className="font-medium text-brand-blue hover:underline">{m.name}</Link> : <span className="font-medium">{m.name}</span>}
                <p className="text-muted-foreground">{m.summary}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
    );
  });
}
