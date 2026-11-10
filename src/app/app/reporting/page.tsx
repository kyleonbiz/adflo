import type { Metadata } from "next";
import { ReportingPage } from "@/components/reporting/reporting-page";
import { renderAppShell } from "@/lib/app-shell";
import { loadReportSources } from "@/lib/reporting/data";

export const metadata: Metadata = { title: "Reporting" };
export const dynamic = "force-dynamic";

export default async function ReportingRoute({ searchParams }: PageProps<"/app/reporting">) {
  const { view, section } = await searchParams;
  const sources = await loadReportSources();
  return renderAppShell("/app/reporting", () => (
    <ReportingPage
      key={typeof section === "string" ? section : "reports"}
      sources={sources}
      initialSection={typeof section === "string" ? section : undefined}
      initialView={typeof view === "string" ? view : undefined}
      preview="Reports read the records in each service. Imported files are read in your browser and never uploaded, and no summaries are emailed."
    />
  ));
}
