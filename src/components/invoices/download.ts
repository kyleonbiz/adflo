import { downloadFile } from "@/lib/download";
import { textToPdf } from "@/lib/forms/pdf";
import { invoiceText, type SharedInvoice } from "@/lib/invoices/share";

/** Saves the invoice to the user's computer as a real PDF named `invoice-<number>.pdf`. */
export function downloadInvoice(inv: SharedInvoice) {
  downloadFile(`invoice-${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`, textToPdf(invoiceText(inv)) as BlobPart, "application/pdf");
}
