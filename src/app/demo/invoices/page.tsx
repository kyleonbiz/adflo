import type { Metadata } from "next";
import { InvoicesPage } from "@/components/invoices/invoices-page";
import { ModuleNav } from "@/components/modules/module-nav";

export const metadata: Metadata = { title: "Invoices" };

export default function DemoInvoices() {
  return (
    <>
      <ModuleNav base="/demo" active="invoices" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <InvoicesPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no emails are sent." />
      </main>
    </>
  );
}
