import type { Metadata } from "next";
import { VendorsPage } from "@/components/vendors/vendors-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

export default function VendorsRoute() {
  return renderAppShell("/app/vendors", (_mode, user) => (
    <VendorsPage approver={user?.name} preview="Records live only in this browser tab. Nothing is saved and no notifications are sent." />
  ));
}
