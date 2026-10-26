import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SaveInvoiceButton } from "@/components/invoices/save-invoice-button";
import { INVOICE_CSS, decodeInvoice, invoiceBodyHtml } from "@/lib/invoices/share";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/** Public, plain invoice view. Everything shown is carried in the link itself. */
export default async function SharedInvoicePage({ params }: PageProps<"/invoice/[token]">) {
  const { token } = await params;
  const inv = decodeInvoice(token);
  if (!inv) notFound();
  return (
    <main className="bg-white text-black">
      <style>{INVOICE_CSS}</style>
      {/* invoiceBodyHtml escapes every user-supplied value */}
      <div dangerouslySetInnerHTML={{ __html: invoiceBodyHtml(inv) }} />
      <div className="mx-auto max-w-[60rem] px-6 pb-10">
        <SaveInvoiceButton invoice={inv} />
      </div>
    </main>
  );
}
