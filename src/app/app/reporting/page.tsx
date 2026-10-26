import type { Metadata } from "next";
import { ReportingPage } from "@/components/reporting/reporting-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Data Entry & Reporting" };
export const dynamic = "force-dynamic";

export default function ReportingRoute() {
  return renderAppShell("reporting", "/app/reporting", () => (
    <ReportingPage preview="Preview: imported data is held in this page only and is not saved. Summaries are previewed, not emailed." />
  ));
}
