import { z } from "zod";
import { isDay } from "@/lib/dates";
import { LICENSE_CATEGORIES } from "./types";

const day = z.string().refine(isDay, "Enter a valid date");

export const licenseFormSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(120, "Keep it under 120 characters"),
    category: z.enum(LICENSE_CATEGORIES.map((c) => c.value) as [string, ...string[]]),
    issuer: z.string().trim().max(120, "Keep it under 120 characters"),
    number: z.string().trim().max(60, "Keep it under 60 characters"),
    holder: z.string().trim().max(120, "Keep it under 120 characters"),
    issuedOn: day,
    expiresOn: day,
    renewalTermMonths: z.coerce.number().int("Whole months only").min(1, "At least 1 month").max(120, "At most 120 months"),
    reminderDays: z
      .string()
      .transform((s) => s.split(",").map((p) => p.trim()).filter(Boolean).map(Number))
      .pipe(
        z
          .array(z.number({ error: "Reminders are whole numbers of days, like 60, 30, 7" }).int("Reminders are whole numbers of days, like 60, 30, 7").min(1, "Reminders must be 1 day or more").max(730, "Reminders must be within 2 years"))
          .min(1, "Add at least one reminder, e.g. 60, 30, 7")
          .max(8, "Use at most 8 reminders"),
      ),
    notes: z.string().trim().max(1000, "Keep notes under 1000 characters"),
    /** One required document per line. Only used when adding; existing licenses manage theirs on the card. */
    documents: z
      .string()
      .transform((s) => s.split("\n").map((l) => l.trim()).filter(Boolean))
      .pipe(z.array(z.string().max(120, "Keep each document under 120 characters")).max(20, "List at most 20 documents")),
  })
  .refine((v) => v.expiresOn > v.issuedOn, { path: ["expiresOn"], message: "Expiry must be after the issue date" });

export type LicenseFormInput = z.input<typeof licenseFormSchema>;
export type LicenseFormValues = z.output<typeof licenseFormSchema>;
