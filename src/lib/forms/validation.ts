import { z } from "zod";
import { FIELD_TYPES } from "./types";

const fieldSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().trim().min(1, "Every field needs a label").max(80, "Keep labels under 80 characters"),
    type: z.enum(FIELD_TYPES.map((t) => t.value) as [string, ...string[]]),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1, "Options cannot be empty").max(60, "Keep options under 60 characters")).max(20, "At most 20 options"),
  })
  .refine((f) => f.type !== "select" || f.options.length >= 2, {
    path: ["options"], message: "A dropdown needs at least two options",
  });

export const formBuilderSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a form name").max(120, "Keep it under 120 characters"),
    description: z.string().trim().max(300, "Keep it under 300 characters"),
    fields: z.array(fieldSchema).min(1, "Add at least one field").max(30, "At most 30 fields"),
    requiresApproval: z.boolean(),
    approver: z.string().trim().max(80, "Keep it under 80 characters"),
    documentTemplate: z.string().max(4000, "Keep the template under 4000 characters"),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const f of v.fields) {
      const key = f.label.trim().toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["fields"], message: `Two fields are called "${f.label.trim()}". Labels must be unique.` });
      seen.add(key);
    }
    if (v.requiresApproval && v.approver.trim() === "") ctx.addIssue({ code: "custom", path: ["approver"], message: "Enter who approves submissions" });
  });

export type FormBuilderInput = z.input<typeof formBuilderSchema>;
export type FormBuilderValues = z.output<typeof formBuilderSchema>;
