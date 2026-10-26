import { z } from "zod";
import { isDay } from "@/lib/dates";
import { RECURRENCES } from "./types";

const day = z.string().refine(isDay, "Enter a valid date");

/** "1,250.50" -> 125050. Rejects anything that is not a plain dollar amount. */
export function parseDollars(input: string): number | null {
  const s = input.trim().replace(/^\$/, "");
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.replace(/,/g, "").split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const invoiceFormSchema = z
  .object({
    number: z.string().trim().min(1, "Enter an invoice number").max(40, "Keep it under 40 characters"),
    client: z.string().trim().min(2, "Enter the client name").max(120, "Keep it under 120 characters"),
    clientEmail: z.string().trim().max(254, "Keep it under 254 characters")
      .refine((v) => v === "" || /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(v), "Enter one valid email address"),
    description: z.string().trim().max(200, "Keep it under 200 characters"),
    amount: z.string().transform((v, ctx) => {
      const cents = parseDollars(v);
      if (cents === null) ctx.addIssue({ code: "custom", message: "Enter an amount like 1250.00" });
      else if (cents <= 0) ctx.addIssue({ code: "custom", message: "Amount must be more than zero" });
      else if (cents > 100_000_000_00) ctx.addIssue({ code: "custom", message: "Amount is too large" });
      return cents ?? 0;
    }),
    issuedOn: day,
    dueOn: day,
    recurrence: z.enum(RECURRENCES.map((r) => r.value) as [string, ...string[]]),
    reminderDays: z
      .string()
      .transform((s) => s.split(",").map((p) => p.trim()).filter(Boolean).map(Number))
      .pipe(z.array(z.number().int().min(1, "Reminders must be 1 day or more").max(365, "Reminders must be within a year")).max(8, "Use at most 8 reminders")),
    notes: z.string().trim().max(1000, "Keep notes under 1000 characters"),
  })
  .refine((v) => v.dueOn >= v.issuedOn, { path: ["dueOn"], message: "Due date cannot be before the issue date" });

export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
export type InvoiceFormValues = z.output<typeof invoiceFormSchema>;
