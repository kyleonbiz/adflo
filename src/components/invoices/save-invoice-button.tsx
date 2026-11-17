"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SharedInvoice } from "@/lib/invoices/share";
import { downloadInvoice } from "./download";

/** Saves a PDF copy of the invoice to the visitor's computer. */
export function SaveInvoiceButton({ invoice }: { invoice: SharedInvoice }) {
  return <Button onClick={() => downloadInvoice(invoice)}><Download /> Save to computer</Button>;
}
