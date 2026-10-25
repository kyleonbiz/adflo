import type { Metadata } from "next";
import { InvoicesPage } from "@/components/invoices/invoices-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default function InvoicesRoute() {
  return renderAppShell("invoices", "/app/invoices", () => (
    <InvoicesPage preview="Preview data: invoices you add or change here are not saved yet, and no reminders are sent. Saving arrives when the database is connected." />
  ));
}
