import type { Metadata } from "next";
import { ReportingPage } from "@/components/reporting/reporting-page";
import { renderAppShell } from "@/lib/app-shell";
import { loadReportSources } from "@/lib/reporting/data";

export const metadata: Metadata = { title: "Reporting" };
export const dynamic = "force-dynamic";

export default async function ReportingRoute({ searchParams }: PageProps<"/app/reporting">) {
  const { view } = await searchParams;
  const sources = await loadReportSources();
  return renderAppShell("/app/reporting", () => (
    <ReportingPage
      sources={sources}
      initialView={typeof view === "string" ? view : undefined}
      preview="Reports read the records in each service. Files you import under Custom Data are read in your browser and never uploaded. Nothing is saved and no summaries are emailed."
    />
  ));
}
