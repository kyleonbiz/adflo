import type { Metadata } from "next";
import { LicensesPage } from "@/components/licenses/licenses-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Licenses & Renewals" };
export const dynamic = "force-dynamic";

export default async function LicensesRoute({ searchParams }: PageProps<"/app/licenses">) {
  const { q } = await searchParams;
  return renderAppShell("/app/licenses", () => (
    <LicensesPage initialQuery={typeof q === "string" ? q : ""} preview="Records live only in this browser tab. Nothing is saved." />
  ));
}
