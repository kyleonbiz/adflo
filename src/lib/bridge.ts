import { looksSensitive } from "@/lib/assistant/guardrails";
import type { FormField, FormTemplate } from "@/lib/forms/types";

/** The few things a contact and a form have in common. */
export interface Person {
  name: string;
  email: string;
  phone: string;
  company: string;
}

type Key = keyof Person;

/** Which person detail a form field asks for, judged by its label. Company comes first so "Company name" is not read as a person's name. */
export function fieldKey(f: FormField): Key | null {
  const l = f.label.toLowerCase();
  if (/company|business|organi[sz]ation|vendor|claimant/.test(l) && !/email|phone/.test(l)) return "company";
  if (f.type === "email" || /e-?mail/.test(l)) return "email";
  if (/phone|mobile|cell/.test(l)) return "phone";
  if (/\b(name|employee|patient|tenant|buyer|customer|client|driver)\b/.test(l) && f.type === "text") return "name";
  return null;
}

/** Fills the fields a form shares with a contact; everything else is left for the person to fill in. */
export function prefillFromPerson(form: FormTemplate, p: Partial<Person>): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<Key>();
  for (const f of form.fields) {
    const k = fieldKey(f);
    if (k && !used.has(k) && p[k]) { out[f.id] = p[k]!; used.add(k); }
  }
  return out;
}

/** The person behind a submission, or null when it says nobody can be told apart from a nameless entry. */
export function personFromSubmission(form: FormTemplate, values: Record<string, string>, submittedBy: string): Person | null {
  const p: Person = { name: "", email: "", phone: "", company: "" };
  for (const f of form.fields) {
    const k = fieldKey(f);
    const v = (values[f.id] ?? "").trim();
    if (k && v && !p[k]) p[k] = v;
  }
  if (!p.name && submittedBy.trim() && submittedBy.trim() !== "Anonymous") p.name = submittedBy.trim();
  return p.name ? p : null;
}

const query = (p: Partial<Person>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
  return q.toString();
};

export const fillLink = (formId: string, p: Partial<Person>) => `/app/forms?fill=${encodeURIComponent(formId)}${query(p) ? `&${query(p)}` : ""}`;
export const addContactLink = (p: Partial<Person>) => `/app/contacts?add=1${query(p) ? `&${query(p)}` : ""}`;

/** Reads the person out of address-bar parameters. Anyone can type a link, so short text only, a real-looking email, and nothing that looks like a card number or password. */
export function personFromParams(get: (k: string) => string | undefined): Partial<Person> {
  const clean = (v: string | undefined) => {
    const t = (v ?? "").trim().slice(0, 120);
    return looksSensitive(t) ? "" : t;
  };
  const email = clean(get("email"));
  return { name: clean(get("name")), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "", phone: clean(get("phone")), company: clean(get("company")) };
}
