import { z } from "zod";
import { isDay } from "@/lib/dates";
import { invoiceTotals } from "./logic";
import { RECURRENCES } from "./types";

const day = z.string().refine(isDay, "Enter a valid date");

/** "1,250.50" -> 125050. Rejects anything that is not a plain dollar amount. */
export function parseDollars(input: string): number | null {
  const s = input.trim().replace(/^\$/, "");
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.replace(/,/g, "").split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const email = z.string().trim().max(254, "Keep it under 254 characters")
  .refine((v) => v === "" || /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(v), "Enter one valid email address");

const itemSchema = z.object({
  description: z.string().trim().min(1, "Describe the service").max(200, "Keep it under 200 characters"),
  qty: z.string().transform((v, ctx) => {
    const n = /^\d+(\.\d{1,2})?$/.test(v.trim()) ? Number(v) : NaN;
    if (Number.isNaN(n) || n <= 0) ctx.addIssue({ code: "custom", message: "Enter a quantity above zero" });
    else if (n > 100_000) ctx.addIssue({ code: "custom", message: "Quantity is too large" });
    return Number.isNaN(n) ? 0 : n;
  }),
  rate: z.string().transform((v, ctx) => {
    const cents = parseDollars(v);
    if (cents === null) ctx.addIssue({ code: "custom", message: "Enter a rate like 45.00" });
    else if (cents > 10_000_000_00) ctx.addIssue({ code: "custom", message: "Rate is too large" });
    return cents ?? 0;
  }),
});

export const invoiceFormSchema = z
  .object({
    number: z.string().trim().min(1, "Enter an invoice number").max(40, "Keep it under 40 characters"),
    fromName: z.string().trim().min(2, "Enter your business name").max(120, "Keep it under 120 characters"),
    fromAddress: z.string().trim().max(200, "Keep it under 200 characters"),
    fromPhone: z.string().trim().max(40, "Keep it under 40 characters"),
    fromEmail: email,
    client: z.string().trim().min(2, "Enter the client name").max(120, "Keep it under 120 characters"),
    clientEmail: email,
    items: z.array(itemSchema).min(1, "Add at least one service").max(50, "Use at most 50 lines"),
    taxRate: z.string().transform((v, ctx) => {
      const s = v.trim().replace(/%$/, "");
      if (s === "") return 0;
      const n = /^\d+(\.\d{1,3})?$/.test(s) ? Number(s) : NaN;
      if (Number.isNaN(n) || n > 100) {
        ctx.addIssue({ code: "custom", message: "Enter a tax rate from 0 to 100, like 0.925" });
        return 0;
      }
      return n;
    }),
    issuedOn: day,
    dueOn: day,
    paymentMethods: z
      .string()
      .transform((s) => s.split(/\r?\n/).map((p) => p.trim()).filter(Boolean))
      .pipe(z.array(z.string().max(120, "Keep each method under 120 characters")).max(6, "Use at most 6 payment methods")),
    recurrence: z.enum(RECURRENCES.map((r) => r.value) as [string, ...string[]]),
    reminderDays: z
      .string()
      .transform((s) => s.split(",").map((p) => p.trim()).filter(Boolean).map(Number))
      .pipe(z.array(z.number().int().min(1, "Reminders must be 1 day or more").max(365, "Reminders must be within a year")).max(8, "Use at most 8 reminders")),
    notes: z.string().trim().max(1000, "Keep notes under 1000 characters"),
  })
  .refine((v) => v.dueOn >= v.issuedOn, { path: ["dueOn"], message: "Due date cannot be before the issue date" })
  .refine((v) => invoiceTotals(v.items.map((i) => ({ description: i.description, qty: i.qty, rateCents: i.rate })), v.taxRate).totalCents > 0, {
    path: ["items"], message: "The total must be more than zero",
  });

export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
export type InvoiceFormValues = z.output<typeof invoiceFormSchema>;
