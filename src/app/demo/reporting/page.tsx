import type { Metadata } from "next";
import { ModuleNav } from "@/components/modules/module-nav";
import { ReportingPage } from "@/components/reporting/reporting-page";

export const metadata: Metadata = { title: "Data Entry & Reporting" };

export default function DemoReporting() {
  return (
    <>
      <ModuleNav base="/demo" active="reporting" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <ReportingPage preview="Demo: files are read in your browser and never uploaded. Nothing is saved and no summaries are emailed." />
      </main>
    </>
  );
}
