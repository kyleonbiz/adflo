import { formatDayLong, isDay } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import type { FormField, FormTemplate, Submission } from "./types";

export const MAX_SHORT = 200;
export const MAX_LONG = 2000;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type FieldErrors = Record<string, string>;

/** Checks a filled-in form. Returns an error message per field id; empty means valid. */
export function validateSubmission(form: FormTemplate, values: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of form.fields) {
    const v = (values[f.id] ?? "").trim();
    if (f.type === "checkbox") {
      if (f.required && values[f.id] !== "true") errors[f.id] = "This must be checked";
      continue;
    }
    if (v === "") {
      if (f.required) errors[f.id] = "This field is required";
      continue;
    }
    const error = checkValue(f, v);
    if (error) errors[f.id] = error;
  }
  return errors;
}

function checkValue(f: FormField, v: string): string | null {
  switch (f.type) {
    case "text": return v.length > MAX_SHORT ? `Keep it under ${MAX_SHORT} characters` : null;
    case "longtext": return v.length > MAX_LONG ? `Keep it under ${MAX_LONG} characters` : null;
    case "email": return v.length > 254 || !EMAIL.test(v) ? "Enter a valid email address" : null;
    case "number": return /^-?\d+(\.\d+)?$/.test(v) && Number.isFinite(Number(v)) ? null : "Enter a number";
    case "date": return isDay(v) ? null : "Enter a valid date";
    case "select": return f.options.includes(v) ? null : "Choose one of the options";
    default: return null;
  }
}

/** Trims text and fills missing checkboxes with "false", keeping only the form's own fields. */
export function cleanValues(form: FormTemplate, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of form.fields) {
    out[f.id] = f.type === "checkbox" ? (values[f.id] === "true" ? "true" : "false") : (values[f.id] ?? "").trim();
  }
  return out;
}

/** A new response starts as "new". */
export function createSubmission(
  form: FormTemplate, values: Record<string, string>, submittedBy: string, today: string, id: string,
): Submission {
  return {
    id, formId: form.id, submittedBy: submittedBy.trim() || "Anonymous", submittedOn: today,
    values: cleanValues(form, values), status: "new",
  };
}

export const markDone = (s: Submission, done: boolean): Submission => ({ ...s, status: done ? "done" : "new" });

export function displayValue(f: FormField, raw: string | undefined): string {
  if (f.type === "checkbox") return raw === "true" ? "Yes" : "No";
  if (f.type === "date" && raw && isDay(raw)) return formatDayLong(raw);
  return raw ?? "";
}

/**
 * Fills `{{Field label}}` placeholders from a submission in a single pass, so a value that itself
 * contains "{{...}}" is never expanded again. Unknown placeholders become empty.
 */
export function generateDocument(form: FormTemplate, s: Submission): string {
  const byLabel = new Map(form.fields.map((f) => [f.label.toLowerCase(), f]));
  const filled = (template: string) =>
    template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, label: string) => {
      const f = byLabel.get(label.toLowerCase());
      return f ? displayValue(f, s.values[f.id]) : "";
    });

  const body = form.documentTemplate.trim()
    ? filled(form.documentTemplate)
    : form.fields.map((f) => `${f.label}: ${displayValue(f, s.values[f.id])}`).join("\n");

  const lines = [form.name.toUpperCase(), `Submitted by ${s.submittedBy} on ${formatDayLong(s.submittedOn)}`, "", body];
  return lines.join("\n") + "\n";
}

export function submissionsToCsv(form: FormTemplate, subs: Submission[]): string {
  return toCsv([
    ["Submitted on", "Submitted by", "Status", ...form.fields.map((f) => f.label)],
    ...subs.map((s) => [s.submittedOn, s.submittedBy, s.status, ...form.fields.map((f) => displayValue(f, s.values[f.id]))]),
  ]);
}

export interface PortfolioSummary {
  forms: number;
  /** Times forms have been sent out. */
  sent: number;
  /** Responses collected, and how many of them nobody has dealt with yet. */
  responses: number;
  unread: number;
}

export function summarize(forms: FormTemplate[], subs: Submission[]): PortfolioSummary {
  const ids = new Set(forms.map((f) => f.id));
  const mine = subs.filter((s) => ids.has(s.formId));
  return {
    forms: forms.length,
    sent: forms.reduce((n, f) => n + f.sentCount, 0),
    responses: mine.length,
    unread: mine.filter((s) => s.status === "new").length,
  };
}
