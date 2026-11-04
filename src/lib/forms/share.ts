import { z } from "zod";
import { FIELD_TYPES, type FormField, type FormTemplate } from "./types";
import { cleanValues, validateSubmission } from "./logic";

const fieldSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  type: z.enum(FIELD_TYPES.map((t) => t.value) as [string, ...string[]]),
  required: z.boolean(),
  options: z.array(z.string().max(60)).max(20),
});

/** What a recipient sees of a form: its questions and where their answers go. Nothing else leaves the app. */
const sharedSchema = z.object({
  v: z.literal(1),
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(300),
  fields: z.array(fieldSchema).min(1).max(30),
  replyTo: z.string().max(254),
});
export type SharedForm = z.infer<typeof sharedSchema>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (s: string) => s.length <= 254 && EMAIL.test(s);

const toBase64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

const MAX_TOKEN = 14_000;

/** The form packed into a URL-safe token, so a plain link carries everything the page needs. */
export function encodeForm(form: FormTemplate, replyTo: string): string {
  const shared: SharedForm = { v: 1, id: form.id, name: form.name, description: form.description, fields: form.fields, replyTo };
  return toBase64Url(JSON.stringify(shared));
}

export function decodeForm(token: string): SharedForm | null {
  if (!/^[A-Za-z0-9_-]+$/.test(token) || token.length > MAX_TOKEN) return null;
  try {
    const parsed = sharedSchema.safeParse(JSON.parse(fromBase64Url(token)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const formPath = (form: FormTemplate, replyTo: string) => `/form/${encodeForm(form, replyTo)}`;

/** A `mailto:` link that opens the sender's email app with the form's link in a ready-to-send message. */
export function sendMailto(form: FormTemplate, link: string, recipients: string[]): string {
  const subject = `Please fill out: ${form.name}`;
  const body = `Hello,\n\nPlease fill out "${form.name}" using this link:\n${link}\n\nThank you.`;
  return `mailto:${recipients.map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Splits "a@x.com, b@y.com; c@z.com" into valid addresses and the pieces that were not addresses. */
export function parseRecipients(text: string): { emails: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  return { emails: [...new Set(parts.filter(isEmail))], invalid: parts.filter((p) => !isEmail(p)) };
}

// --- Answers coming back ---------------------------------------------------------------------------

const responseSchema = z.object({
  f: z.string().min(1).max(60),
  by: z.string().max(80),
  v: z.record(z.string().max(40), z.string().max(2000)),
});
const MARKER = "ADFLO-RESPONSE:";

/** The answers as plain text for a person to read, followed by one line the sender's AdFlo can read back in. */
export function responseMessage(form: SharedForm, submittedBy: string, values: Record<string, string>): string {
  const fields = form.fields as FormField[];
  const clean = cleanValues({ ...form, fields, documentTemplate: "", sentCount: 0 }, values);
  const who = submittedBy.trim().slice(0, 80);
  const answers = fields.map((f) => `${f.label}: ${f.type === "checkbox" ? (clean[f.id] === "true" ? "Yes" : "No") : clean[f.id]}`);
  const token = toBase64Url(JSON.stringify({ f: form.id, by: who, v: clean }));
  return [
    `Answers to "${form.name}"`,
    ...(who ? [`From: ${who}`] : []),
    "",
    ...answers,
    "",
    "Please keep the line below: it lets AdFlo add these answers automatically.",
    `${MARKER}${token}`,
  ].join("\n");
}

export function responseMailto(form: SharedForm, submittedBy: string, values: Record<string, string>): string {
  return `mailto:${encodeURIComponent(form.replyTo)}?subject=${encodeURIComponent(`Answers: ${form.name}`)}&body=${encodeURIComponent(responseMessage(form, submittedBy, values))}`;
}

export interface ParsedResponses { responses: { submittedBy: string; values: Record<string, string> }[]; problems: string[] }

/** Reads every AdFlo answer line out of pasted email text, keeping only answers that belong to `form` and still fit it. */
export function parseResponses(text: string, form: FormTemplate): ParsedResponses {
  const out: ParsedResponses = { responses: [], problems: [] };
  const tokens = [...text.matchAll(/ADFLO-RESPONSE:([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  if (tokens.length === 0) { out.problems.push("No AdFlo answers were found in that text. Paste the whole email, including the line that starts with ADFLO-RESPONSE."); return out; }
  tokens.forEach((token, i) => {
    const n = tokens.length > 1 ? ` (answer ${i + 1})` : "";
    let data: z.infer<typeof responseSchema> | null = null;
    try { const r = responseSchema.safeParse(JSON.parse(fromBase64Url(token))); data = r.success ? r.data : null; } catch { data = null; }
    if (!data) { out.problems.push(`Could not read the answers${n}. The line may have been cut off.`); return; }
    if (data.f !== form.id) { out.problems.push(`These answers${n} are for a different form.`); return; }
    const values = cleanValues(form, data.v);
    const errors = validateSubmission(form, values);
    if (Object.keys(errors).length > 0) { out.problems.push(`The answers${n} do not fit this form any more (it may have been edited since it was sent).`); return; }
    out.responses.push({ submittedBy: data.by, values });
  });
  return out;
}
