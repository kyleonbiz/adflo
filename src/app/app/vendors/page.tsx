import type { Metadata } from "next";
import { VendorsPage } from "@/components/vendors/vendors-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

export default function VendorsRoute() {
  return renderAppShell("vendors", "/app/vendors", () => (
    <VendorsPage preview="Preview data: vendors you add or change here are not saved yet, and no notifications are sent. Saving arrives when the database is connected." />
  ));
}
