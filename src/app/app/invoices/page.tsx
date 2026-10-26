import type { Metadata } from "next";
import { InvoicesPage } from "@/components/invoices/invoices-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesRoute({ searchParams }: PageProps<"/app/invoices">) {
  const { new: startNew } = await searchParams;
  return renderAppShell("/app/invoices", () => (
    <InvoicesPage startNew={startNew === "1"} preview="Records live only in this browser tab. Nothing is saved and no emails are sent." />
  ));
}
