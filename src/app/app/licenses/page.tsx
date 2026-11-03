import type { Metadata } from "next";
import { LicensesPage } from "@/components/licenses/licenses-page";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Licenses & Renewals" };
export const dynamic = "force-dynamic";

export default async function LicensesRoute({ searchParams }: PageProps<"/app/licenses">) {
  const params = await searchParams;
  const { q } = params;
  const startNew = params.new === "1";
  const draft = startNew ? draftFromParams("licenses", (k) => (typeof params[k] === "string" ? (params[k] as string) : undefined)) : undefined;
  return renderAppShell("/app/licenses", () => (
    <LicensesPage startNew={startNew} draft={draft} initialQuery={typeof q === "string" ? q : ""} preview="Records live only in this browser tab. Nothing is saved." />
  ));
}
