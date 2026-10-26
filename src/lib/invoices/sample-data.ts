import { addDays, addMonths } from "@/lib/dates";
import type { Invoice } from "./types";

/** Sample invoices with dates relative to `today`, so every state is represented. */
export function sampleInvoices(today: string): Invoice[] {
  const base = { reminderDays: [7, 1], notes: "", clientEmail: "" };
  return [
    { ...base, id: "inv-1", number: "INV-0041", client: "Northwind Traders", description: "October bookkeeping",
      amountCents: 185_000, issuedOn: addDays(today, -40), dueOn: addDays(today, -10), status: "sent", paidOn: null, recurrence: "monthly" },
    { ...base, id: "inv-2", number: "INV-0042", client: "Contoso Ltd", description: "Vendor onboarding setup",
      amountCents: 62_500, issuedOn: addDays(today, -36), dueOn: addDays(today, -3), status: "sent", paidOn: null, recurrence: "none" },
    { ...base, id: "inv-3", number: "INV-0043", client: "Fabrikam Inc", description: "Quarterly license tracking",
      amountCents: 240_000, issuedOn: addDays(today, -23), dueOn: addDays(today, 4), status: "sent", paidOn: null, recurrence: "quarterly" },
    { ...base, id: "inv-4", number: "INV-0044", client: "Adventure Works", description: "Document preparation",
      amountCents: 98_000, issuedOn: addDays(today, -5), dueOn: addDays(today, 25), status: "sent", paidOn: null, recurrence: "none" },
    { ...base, id: "inv-5", number: "INV-0045", client: "Tailspin Toys", description: "Data entry project, phase 2",
      amountCents: 310_000, issuedOn: today, dueOn: addDays(today, 30), status: "draft", paidOn: null, recurrence: "none" },
    { ...base, id: "inv-6", number: "INV-0040", client: "Northwind Traders", description: "September bookkeeping",
      amountCents: 185_000, issuedOn: addMonths(today, -2), dueOn: addDays(addMonths(today, -2), 30), status: "paid", paidOn: addDays(today, -1), recurrence: "monthly" },
    { ...base, id: "inv-7", number: "INV-0039", client: "Wingtip Toys", description: "Back office setup",
      amountCents: 120_000, issuedOn: addMonths(today, -3), dueOn: addDays(addMonths(today, -3), 30), status: "void", paidOn: null, recurrence: "none" },
  ];
}
