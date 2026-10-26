import type { Metadata } from "next";
import { InvoicesPage } from "@/components/invoices/invoices-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default function InvoicesRoute() {
  return renderAppShell("/app/invoices", () => (
    <InvoicesPage preview="Sample data that lives only in this browser tab. Nothing is saved and no emails are sent." />
  ));
}
