import type { DmsApi } from "@/lib/dms/client/api";
import { toDmsError } from "@/lib/dms/errors";
import { invoiceToPdf } from "./pdf";
import type { Invoice } from "./types";

/** The file name an invoice is saved under in Documents. */
export const invoiceFileName = (inv: Pick<Invoice, "number">) => `invoice-${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`;

/**
 * Saves the invoice as a PDF in Documents, in the "Invoices" folder (the workspace's own folder, or the top level if there is none),
 * filed under the Invoice category. Returns the folder it landed in. Throws a plain-English message when it cannot.
 */
export async function saveInvoiceToDocuments(api: DmsApi, inv: Invoice): Promise<{ fileName: string; folder: string }> {
  try {
    const boot = await api.bootstrap();
    const folder = boot.folders.find((f) => f.name.toLowerCase() === "invoices" && f.isSystem) ?? boot.folders.find((f) => f.name.toLowerCase() === "invoices") ?? null;
    const fileName = invoiceFileName(inv);
    const file = new File([invoiceToPdf(inv) as BlobPart], fileName, { type: "application/pdf" });
    await api.uploadFile({ file, folderId: folder?.id ?? null, category: "invoice" });
    return { fileName, folder: folder?.name ?? "Documents" };
  } catch (e) {
    throw new Error(toDmsError(e).message);
  }
}
