import { daysBetween, formatDayLong, isDay } from "@/lib/dates";
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

/** A form that needs approval starts "pending"; otherwise the submission is simply "received". */
export function createSubmission(
  form: FormTemplate, values: Record<string, string>, submittedBy: string, today: string, id: string,
): Submission {
  return {
    id, formId: form.id, submittedBy: submittedBy.trim() || "Anonymous", submittedOn: today,
    values: cleanValues(form, values), status: form.requiresApproval ? "pending" : "received",
    decidedBy: null, decidedOn: null, comment: "",
  };
}

/** Approve or reject a pending submission. Anything already decided (or never pending) is returned unchanged. */
export function decide(
  s: Submission, decision: "approved" | "rejected", by: string, today: string, comment = "",
): Submission {
  if (s.status !== "pending") return s;
  return { ...s, status: decision, decidedBy: by, decidedOn: today, comment: comment.trim() };
}

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

  const status = s.status === "received" ? "Received" : s.status[0].toUpperCase() + s.status.slice(1);
  const lines = [form.name.toUpperCase(), `Submitted by ${s.submittedBy} on ${formatDayLong(s.submittedOn)}`, "", body, "", `Status: ${status}`];
  if (s.decidedBy && s.decidedOn) lines.push(`Decision by ${s.decidedBy} on ${formatDayLong(s.decidedOn)}${s.comment ? `: ${s.comment}` : ""}`);
  return lines.join("\n") + "\n";
}

export function submissionsToCsv(form: FormTemplate, subs: Submission[]): string {
  return toCsv([
    ["Submitted on", "Submitted by", "Status", "Decided by", "Decided on", "Comment", ...form.fields.map((f) => f.label)],
    ...subs.map((s) => [
      s.submittedOn, s.submittedBy, s.status, s.decidedBy ?? "", s.decidedOn ?? "", s.comment,
      ...form.fields.map((f) => displayValue(f, s.values[f.id])),
    ]),
  ]);
}

export interface QueueItem {
  form: FormTemplate;
  submission: Submission;
  daysWaiting: number;
}

/** Every submission still waiting for a decision, longest-waiting first. */
export function approvalQueue(forms: FormTemplate[], subs: Submission[], today: string): QueueItem[] {
  const byId = new Map(forms.map((f) => [f.id, f]));
  return subs
    .filter((s) => s.status === "pending" && byId.has(s.formId))
    .map((s) => ({ form: byId.get(s.formId)!, submission: s, daysWaiting: Math.max(0, daysBetween(s.submittedOn, today)) }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting || a.submission.submittedBy.localeCompare(b.submission.submittedBy));
}

/** Newest first, with anything awaiting a decision on top. */
export function sortSubmissions(subs: Submission[]): Submission[] {
  return [...subs].sort((a, b) =>
    Number(b.status === "pending") - Number(a.status === "pending") || (a.submittedOn < b.submittedOn ? 1 : a.submittedOn > b.submittedOn ? -1 : 0));
}

/** True when another form already uses this name (ignoring case and spacing). */
export function formNameTaken(forms: FormTemplate[], name: string, exceptId?: string): boolean {
  const key = name.trim().toLowerCase();
  return forms.some((f) => f.id !== exceptId && f.name.trim().toLowerCase() === key);
}

export interface PortfolioSummary {
  forms: number;
  submissions: number;
  pending: number;
  decidedThisMonth: number;
}

export function summarize(forms: FormTemplate[], subs: Submission[], today: string): PortfolioSummary {
  const month = today.slice(0, 7);
  const ids = new Set(forms.map((f) => f.id));
  const mine = subs.filter((s) => ids.has(s.formId));
  return {
    forms: forms.length,
    submissions: mine.length,
    pending: mine.filter((s) => s.status === "pending").length,
    decidedThisMonth: mine.filter((s) => s.decidedOn?.startsWith(month)).length,
  };
}
