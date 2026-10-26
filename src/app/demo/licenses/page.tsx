import type { Metadata } from "next";
import { LicensesPage } from "@/components/licenses/licenses-page";

export const metadata: Metadata = { title: "Licenses & Renewals" };

export default function DemoLicenses() {
  return (
    <LicensesPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved." />
  );
}
