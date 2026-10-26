import { z } from "zod";
import { VENDOR_CATEGORIES } from "./types";

export const vendorFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the vendor name").max(120, "Keep it under 120 characters"),
  category: z.enum(VENDOR_CATEGORIES),
  contactName: z.string().trim().max(80, "Keep it under 80 characters"),
  email: z.string().trim().min(1, "Enter a contact email").max(254, "Email is too long")
    .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address"),
  phone: z.string().trim().max(30, "Keep it under 30 characters")
    .refine((v) => v === "" || /^[+\d][\d\s().-]{5,}$/.test(v), "Enter a valid phone number"),
  taxId: z.string().trim()
    .refine((v) => v === "" || /^\d{2}-?\d{7}$/.test(v), "Tax ID looks like 12-3456789")
    .transform((v) => v.replace("-", "")),
  notes: z.string().trim().max(1000, "Keep notes under 1000 characters"),
});

export type VendorFormInput = z.input<typeof vendorFormSchema>;
export type VendorFormValues = z.output<typeof vendorFormSchema>;

export const documentFormSchema = z.object({
  type: z.string().trim().min(1, "Enter a document name").max(80, "Keep it under 80 characters"),
  required: z.boolean(),
});
