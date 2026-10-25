import { z } from "zod";
import { isDay } from "@/lib/dates";
import { PROJECT_STATUSES, TASK_REPEATS } from "./types";

const day = z.string().refine(isDay, "Enter a valid date");

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a project name").max(120, "Keep it under 120 characters"),
    client: z.string().trim().max(120, "Keep it under 120 characters"),
    description: z.string().trim().max(500, "Keep it under 500 characters"),
    status: z.enum(PROJECT_STATUSES.map((s) => s.value) as [string, ...string[]]),
    startOn: day,
    dueOn: day,
  })
  .refine((v) => v.dueOn >= v.startOn, { path: ["dueOn"], message: "Due date cannot be before the start date" });

export type ProjectFormInput = z.input<typeof projectFormSchema>;
export type ProjectFormValues = z.output<typeof projectFormSchema>;

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a task").max(160, "Keep it under 160 characters"),
    assignee: z.string().trim().max(80, "Keep it under 80 characters"),
    dueOn: z.string().refine((v) => v === "" || isDay(v), "Enter a valid date"),
    repeat: z.enum(TASK_REPEATS.map((r) => r.value) as [string, ...string[]]),
  })
  .refine((v) => v.repeat === "none" || v.dueOn !== "", { path: ["dueOn"], message: "A repeating task needs a due date" });

export type TaskFormValues = z.output<typeof taskFormSchema>;
