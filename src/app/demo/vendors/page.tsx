import type { Metadata } from "next";
import { ModuleNav } from "@/components/modules/module-nav";
import { VendorsPage } from "@/components/vendors/vendors-page";

export const metadata: Metadata = { title: "Vendors" };

export default function DemoVendors() {
  return (
    <>
      <ModuleNav base="/demo" active="vendors" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <VendorsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no notifications are sent." />
      </main>
    </>
  );
}
