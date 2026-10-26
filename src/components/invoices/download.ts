import { invoiceHtml } from "@/lib/invoices/share";
import type { Invoice } from "@/lib/invoices/types";

/** Saves the plain invoice layout to the user's computer as `invoice-<number>.html`. */
export function downloadInvoice(inv: Invoice) {
  const url = URL.createObjectURL(new Blob([invoiceHtml(inv)], { type: "text/html;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${inv.number.replace(/[^\w.-]+/g, "_")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
