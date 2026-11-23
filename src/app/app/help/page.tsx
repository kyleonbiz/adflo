import type { Metadata } from "next";
import Link from "next/link";
import { renderAppShell } from "@/lib/app-shell";
import { BillingPanel } from "@/components/billing-panel";
import { PlanLimitsTable } from "@/components/plan-limits";
import { MODULES, moduleHref } from "@/lib/modules/registry";

export const metadata: Metadata = { title: "Help & Training" };
export const dynamic = "force-dynamic";

const TIPS = [
  "Press the + Add button in the menu to create a document, invoice, contact or task from anywhere.",
  "Star a document to protect it: starred documents cannot be deleted until you remove the star.",
  "Deleted documents wait in Trash. Open Trash and choose Empty trash to remove them for good.",
  "Use Send on a document, form or report to email it or copy a link.",
];

export default function HelpRoute() {
  return renderAppShell("/app/help", () => (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help &amp; Training</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quick guides for each part of AdFlo. For anything else, email support@adflo.pro.</p>
      </div>
      <section aria-label="Tips" className="rounded-2xl border bg-card p-6 shadow-panel">
        <h2 className="text-base font-semibold">Good to know</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
      <BillingPanel />
      <section aria-label="Plans and limits" className="rounded-2xl border bg-card p-6 shadow-panel">
        <h2 className="text-base font-semibold">Plans &amp; limits</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">What each AdFlo plan includes. To add seats, storage or Claude actions, email support@adflo.pro.</p>
        <PlanLimitsTable />
      </section>
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
  ));
}
