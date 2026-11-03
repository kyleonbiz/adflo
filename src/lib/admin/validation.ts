import { z } from "zod";
import { isDay } from "@/lib/dates";
import { CATEGORIES, PRIORITIES } from "./types";

const category = z.enum(CATEGORIES);

export const requestFormSchema = z.object({
  title: z.string().trim().min(3, "Enter a short title").max(120, "Keep it under 120 characters"),
  description: z.string().trim().max(1000, "Keep it under 1000 characters"),
  requester: z.string().trim().max(80, "Keep it under 80 characters"),
  category,
  priority: z.enum(PRIORITIES),
  dueOn: z.string().refine((v) => v === "" || isDay(v), "Enter a valid date").transform((v) => (v === "" ? null : v)),
});
export type RequestFormInput = z.input<typeof requestFormSchema>;
export type RequestFormValues = z.output<typeof requestFormSchema>;
