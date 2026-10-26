import type { Metadata } from "next";
import { InvoicesPage } from "@/components/invoices/invoices-page";

export const metadata: Metadata = { title: "Invoices" };

export default function DemoInvoices() {
  return (
    <InvoicesPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no emails are sent." />
  );
}
