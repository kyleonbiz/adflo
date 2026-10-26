import type { Metadata } from "next";
import { VendorsPage } from "@/components/vendors/vendors-page";

export const metadata: Metadata = { title: "Vendors" };

export default function DemoVendors() {
  return (
    <VendorsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no notifications are sent." />
  );
}
