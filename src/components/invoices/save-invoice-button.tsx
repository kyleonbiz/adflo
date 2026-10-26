"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invoiceHtml, type SharedInvoice } from "@/lib/invoices/share";

/** Saves a plain HTML copy of the invoice to the visitor's computer. */
export function SaveInvoiceButton({ invoice }: { invoice: SharedInvoice }) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([invoiceHtml(invoice)], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${invoice.number.replace(/[^\w.-]+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return <Button onClick={save}><Download /> Save to computer</Button>;
}
