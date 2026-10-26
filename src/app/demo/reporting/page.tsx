import type { Metadata } from "next";
import { ReportingPage } from "@/components/reporting/reporting-page";

export const metadata: Metadata = { title: "Data Entry & Reporting" };

export default function DemoReporting() {
  return (
    <ReportingPage preview="Demo: files are read in your browser and never uploaded. Nothing is saved and no summaries are emailed." />
  );
}
