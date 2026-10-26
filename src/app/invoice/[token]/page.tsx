import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SaveInvoiceButton } from "@/components/invoices/save-invoice-button";
import { formatDayLong } from "@/lib/dates";
import { formatMoney } from "@/lib/invoices/logic";
import { decodeInvoice } from "@/lib/invoices/share";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

const STATUS = { draft: "Draft", sent: "Awaiting payment", paid: "Paid", void: "Void" } as const;

/** Public, plain invoice view. Everything shown is carried in the link itself. */
export default async function SharedInvoicePage({ params }: PageProps<"/invoice/[token]">) {
  const { token } = await params;
  const inv = decodeInvoice(token);
  if (!inv) notFound();
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoice {inv.number}</h1>
        <p className="text-muted-foreground">{inv.client}{inv.description && ` · ${inv.description}`}</p>
      </div>
      <p className="text-3xl font-semibold tabular-nums">{formatMoney(inv.amountCents)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Status</dt><dd>{STATUS[inv.status]}</dd>
        <dt className="text-muted-foreground">Issued</dt><dd>{formatDayLong(inv.issuedOn)}</dd>
        <dt className="text-muted-foreground">Due</dt><dd>{formatDayLong(inv.dueOn)}</dd>
        {inv.paidOn && (<><dt className="text-muted-foreground">Paid</dt><dd>{formatDayLong(inv.paidOn)}</dd></>)}
      </dl>
      {inv.notes && <p className="whitespace-pre-line text-sm">{inv.notes}</p>}
      <SaveInvoiceButton invoice={inv} />
    </main>
  );
}
