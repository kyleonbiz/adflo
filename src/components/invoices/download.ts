import { downloadFile } from "@/lib/download";
import { invoiceToPdf } from "@/lib/invoices/pdf";
import type { SharedInvoice } from "@/lib/invoices/share";

/** Saves the invoice to the user's computer as a real PDF named `invoice-<number>.pdf`, laid out like the invoice page. */
export function downloadInvoice(inv: SharedInvoice) {
  downloadFile(`invoice-${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`, invoiceToPdf(inv) as BlobPart, "application/pdf");
}
