import { toCsv } from "@/lib/csv";
import { isPhone } from "@/lib/phone";
import type { TargetField } from "@/lib/import/mapping";
import type { ImportOutcome, RowResult } from "@/lib/import/run";
import { CONTACT_CATEGORIES, type Contact, type ContactCategory, type ContactInput } from "./types";

export const IMPORT_FIELDS: TargetField[] = [
  { key: "name", label: "Name", aliases: ["Full name", "Contact name", "Contact"], required: true },
  { key: "email", label: "Email", aliases: ["E-mail", "Email address", "Mail"] },
  { key: "phone", label: "Phone", aliases: ["Phone number", "Mobile", "Telephone", "Cell"] },
  { key: "company", label: "Company", aliases: ["Organization", "Organisation", "Business", "Employer"] },
  { key: "category", label: "Category", aliases: ["Type", "Group", "Status"] },
  { key: "notes", label: "Notes", aliases: ["Comments", "Description", "Memo"] },
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export type ContactField = "name" | "email" | "phone" | "company" | "category" | "notes";

/** Validates and normalizes one contact. Returns the cleaned value, or an error sentence per field. */
export function validateContact(
  raw: Record<string, string | undefined>,
): { value: ContactInput; errors: null } | { value: null; errors: Partial<Record<ContactField, string>> } {
  const errors: Partial<Record<ContactField, string>> = {};
  const name = clean(raw.name ?? "");
  const email = clean(raw.email ?? "").toLowerCase();
  const phone = clean(raw.phone ?? "");
  const company = clean(raw.company ?? "");
  const notes = (raw.notes ?? "").trim();
  const categoryText = clean(raw.category ?? "");

  if (name.length < 2) errors.name = "Name is required";
  else if (name.length > 120) errors.name = "Name is longer than 120 characters";
  if (email && (email.length > 254 || !EMAIL.test(email))) errors.email = `"${email.slice(0, 40)}" is not a valid email`;
  if (phone && (phone.length > 30 || !isPhone(phone))) errors.phone = `"${phone.slice(0, 30)}" is not a valid phone number`;
  if (company.length > 120) errors.company = "Company is longer than 120 characters";
  if (notes.length > 1000) errors.notes = "Notes are longer than 1000 characters";

  let category: ContactCategory = "Other";
  if (categoryText) {
    const match = CONTACT_CATEGORIES.find((c) => c.toLowerCase() === categoryText.toLowerCase());
    if (match) category = match;
    else errors.category = `Unknown category "${categoryText.slice(0, 30)}" (use ${CONTACT_CATEGORIES.join(", ")})`;
  }
  if (Object.keys(errors).length > 0) return { value: null, errors };
  return { value: { name, email, phone, company, category, notes }, errors: null };
}

/** Row-level result for the import engine: every problem in the row as a plain sentence. */
export function parseContact(raw: Record<string, string | undefined>): RowResult<ContactInput> {
  const r = validateContact(raw);
  return r.errors ? { ok: false, errors: Object.values(r.errors) } : { ok: true, value: r.value };
}

const digits = (s: string) => s.replace(/\D/g, "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Identity used to spot the same person: the email, else name + company. Empty when there is nothing to go on. */
export function contactKey(c: Pick<ContactInput, "name" | "email" | "company">): string {
  if (c.email) return `e:${c.email.toLowerCase()}`;
  return c.company ? `n:${norm(c.name)}|${norm(c.company)}` : "";
}

export interface ApplyResult {
  contacts: Contact[];
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Adds the accepted rows. Rows that match an existing contact are skipped, or (mode "update")
 * overwrite that contact's non-empty fields. Duplicates inside the file are always skipped.
 */
export function applyImport(
  existing: Contact[], outcome: ImportOutcome<ContactInput>, mode: "skip" | "update", today: string, newId: () => string,
): ApplyResult {
  const contacts = existing.map((c) => ({ ...c }));
  const byKey = new Map<string, Contact>();
  for (const c of contacts) if (!byKey.has(contactKey(c))) byKey.set(contactKey(c), c); // the oldest match wins
  let updated = 0;
  let skipped = outcome.duplicates.filter((d) => d.of === "file").length;
  for (const d of outcome.duplicates) {
    if (d.of !== "existing") continue;
    const target = byKey.get(d.key);
    if (mode === "update" && target) {
      for (const f of ["name", "email", "phone", "company", "notes"] as const) if (d.value[f]) target[f] = d.value[f];
      if (d.value.category !== "Other") target.category = d.value.category;
      updated++;
    } else skipped++;
  }
  const fresh = outcome.accepted.map((a) => ({ ...a.value, id: newId(), createdOn: today }));
  return { contacts: [...contacts, ...fresh], added: fresh.length, updated, skipped };
}

export interface DuplicatePair { a: Contact; b: Contact; reasons: string[] }

export function contactDuplicates(contacts: Contact[]): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const a = contacts[i];
      const b = contacts[j];
      const reasons: string[] = [];
      if (a.email && a.email === b.email) reasons.push("Same email");
      if (digits(a.phone).length >= 7 && digits(a.phone) === digits(b.phone)) reasons.push("Same phone");
      if (a.company && norm(a.name) === norm(b.name) && norm(a.company) === norm(b.company)) reasons.push("Same name and company");
      if (reasons.length > 0) out.push({ a, b, reasons });
    }
  }
  return out;
}

/** Keeps `a`, filling its blanks from `b`. Differing notes are combined. */
export function mergeContacts(a: Contact, b: Contact): Contact {
  const notes = a.notes === b.notes || !b.notes ? a.notes : a.notes ? `${a.notes}\n${b.notes}` : b.notes;
  return {
    ...a,
    email: a.email || b.email, phone: a.phone || b.phone, company: a.company || b.company,
    category: a.category === "Other" ? b.category : a.category, notes: notes.slice(0, 1000),
  };
}

export interface ContactSummary { total: number; duplicatePairs: number; missingEmail: number; missingPhone: number }

export function summarize(contacts: Contact[]): ContactSummary {
  return {
    total: contacts.length,
    duplicatePairs: contactDuplicates(contacts).length,
    missingEmail: contacts.filter((c) => !c.email).length,
    missingPhone: contacts.filter((c) => !c.phone).length,
  };
}

export function contactsToCsv(contacts: Contact[]): string {
  return toCsv([
    ["Name", "Email", "Phone", "Company", "Category", "Notes"],
    ...contacts.map((c) => [c.name, c.email, c.phone, c.company, c.category, c.notes]),
  ]);
}

/** A header-only CSV the user can fill in. */
export const TEMPLATE_CSV = toCsv([IMPORT_FIELDS.map((f) => f.label)]);
