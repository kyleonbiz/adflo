import type { Metadata } from "next";
import { LicensesPage } from "@/components/licenses/licenses-page";
import { ModuleNav } from "@/components/modules/module-nav";

export const metadata: Metadata = { title: "Licenses & Renewals" };

export default function DemoLicenses() {
  return (
    <>
      <ModuleNav base="/demo" active="licenses" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <LicensesPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved." />
      </main>
    </>
  );
}
