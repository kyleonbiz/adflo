import type { Metadata } from "next";
import { LicensesPage } from "@/components/licenses/licenses-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Licenses & Renewals" };
export const dynamic = "force-dynamic";

export default function LicensesRoute() {
  return renderAppShell("/app/licenses", () => (
    <LicensesPage preview="Preview data: licenses you add or change here are not saved yet. Saving arrives when the database is connected." />
  ));
}
