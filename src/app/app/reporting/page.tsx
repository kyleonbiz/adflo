import type { Metadata } from "next";
import { ReportingPage } from "@/components/reporting/reporting-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Data Entry & Reporting" };
export const dynamic = "force-dynamic";

export default function ReportingRoute() {
  return renderAppShell("/app/reporting", () => (
    <ReportingPage preview="Files are read in your browser and never uploaded. Nothing is saved and no summaries are emailed." />
  ));
}
