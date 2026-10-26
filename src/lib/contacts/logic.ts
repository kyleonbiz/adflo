import { toCsv } from "@/lib/csv";
import { daysBetween } from "@/lib/dates";
import { parseDate } from "@/lib/datasets/parse";
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
  { key: "lastContacted", label: "Last contacted", aliases: ["Last contact", "Last contact date", "Last activity", "Last touch"] },
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export type ContactField = "name" | "email" | "phone" | "company" | "category" | "notes" | "lastContacted";

/** "ANN LEE" and "ann lee" become "Ann Lee". Mixed case ("McDonald", "van der Berg") is left as typed. */
export function tidyName(name: string): string {
  if (name !== name.toLowerCase() && name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s\-'’.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** A plain 10-digit US number (with or without a leading 1) becomes "(555) 010-2200"; anything else is left as typed. */
export function tidyPhone(phone: string): string {
  if (phone.includes("+")) return phone;
  const d = phone.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : phone;
}

/** Validates and normalizes one contact. Returns the cleaned value, or an error sentence per field. */
export function validateContact(
  raw: Record<string, string | undefined>,
): { value: ContactInput; errors: null } | { value: null; errors: Partial<Record<ContactField, string>> } {
  const errors: Partial<Record<ContactField, string>> = {};
  const name = tidyName(clean(raw.name ?? ""));
  const email = clean(raw.email ?? "").toLowerCase();
  const rawPhone = clean(raw.phone ?? "");
  const phone = isPhone(rawPhone) ? tidyPhone(rawPhone) : rawPhone;
  const company = clean(raw.company ?? "");
  const notes = (raw.notes ?? "").trim();
  const categoryText = clean(raw.category ?? "");
  const contactedText = clean(raw.lastContacted ?? "");
  const lastContacted = contactedText === "" ? "" : parseDate(contactedText);

  if (name.length === 0) errors.name = "Name is required";
  else if (name.length < 2) errors.name = "Name must be at least 2 characters";
  else if (name.length > 120) errors.name = "Name is longer than 120 characters";
  if (email && (email.length > 254 || !EMAIL.test(email))) errors.email = `"${email.slice(0, 40)}" is not a valid email`;
  if (phone && (phone.length > 30 || !isPhone(rawPhone))) errors.phone = `"${phone.slice(0, 30)}" is not a valid phone number`;
  if (lastContacted === null) errors.lastContacted = `"${contactedText.slice(0, 30)}" is not a valid date (use 2026-03-14 or 3/14/2026)`;
  if (company.length > 120) errors.company = "Company is longer than 120 characters";
  if (notes.length > 1000) errors.notes = "Notes are longer than 1000 characters";

  let category: ContactCategory = "Other";
  if (categoryText) {
    const match = CONTACT_CATEGORIES.find((c) => c.toLowerCase() === categoryText.toLowerCase());
    if (match) category = match;
    else errors.category = `Unknown category "${categoryText.slice(0, 30)}" (use ${CONTACT_CATEGORIES.join(", ")})`;
  }
  if (Object.keys(errors).length > 0) return { value: null, errors };
  return { value: { name, email, phone, company, category, notes, lastContacted: lastContacted ?? "" }, errors: null };
}

const findCategory = (text: string) => CONTACT_CATEGORIES.find((c) => c.toLowerCase() === clean(text).toLowerCase());

/** Distinct category values in the file that are not one of ours (first spelling kept, blanks ignored). */
export function unknownCategories(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of values) {
    const v = clean(raw);
    if (v && !findCategory(v) && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  }
  return [...seen.values()];
}

/** Replaces unrecognised category values using the user's choices (lower-case value -> category). */
export function applyCategoryMap(records: Record<string, string>[], choices: Record<string, ContactCategory>): Record<string, string>[] {
  return records.map((r) => {
    const v = clean(r.category ?? "");
    const choice = v && !findCategory(v) ? choices[v.toLowerCase()] : undefined;
    return choice ? { ...r, category: choice } : r;
  });
}

/** Row-level result for the import engine: every problem in the row as a plain sentence. */
export function parseContact(raw: Record<string, string | undefined>): RowResult<ContactInput> {
  const r = validateContact(raw);
  return r.errors ? { ok: false, errors: Object.values(r.errors) } : { ok: true, value: r.value };
}

const digits = (s: string) => s.replace(/\D/g, "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Identity = Pick<ContactInput, "name" | "email" | "phone" | "company">;

/**
 * Every way a contact can be recognised as the same person: email, phone (7+ digits), and name + company.
 * A contact with no email, phone or company is recognised by name alone. Import and the duplicate
 * finder both use these, so they always agree.
 */
export function contactKeys(c: Identity): string[] {
  const keys: string[] = [];
  if (c.email) keys.push(`e:${c.email.toLowerCase()}`);
  if (digits(c.phone).length >= 7) keys.push(`p:${digits(c.phone)}`);
  if (c.company) keys.push(`n:${norm(c.name)}|${norm(c.company)}`);
  else if (!c.email && digits(c.phone).length < 7 && norm(c.name)) keys.push(`n:${norm(c.name)}|`);
  return keys;
}

const KEY_REASON: Record<string, string> = { e: "Same email", p: "Same phone", n: "Same name and company" };
const REASON_ORDER = ["Same email", "Same phone", "Same name and company"];

/** key -> the oldest contact with it. */
export function keyIndex(contacts: Contact[]): Map<string, Contact> {
  const byKey = new Map<string, Contact>();
  for (const c of contacts) for (const k of contactKeys(c)) if (!byKey.has(k)) byKey.set(k, c);
  return byKey;
}

const UPDATE_FIELDS = ["name", "email", "phone", "company", "notes", "lastContacted"] as const;

/**
 * What an import row would change on the contact it matched. The name is only replaced when the match
 * was by email, so a shared phone number or company line never renames someone.
 */
export function updateChanges(target: Contact, value: ContactInput, matchedKey: string): Partial<ContactInput> {
  const changes: Partial<ContactInput> = {};
  for (const f of UPDATE_FIELDS) {
    if (f === "name" && !matchedKey.startsWith("e:")) continue;
    if (value[f] && value[f] !== target[f]) changes[f] = value[f];
  }
  if (value.category !== "Other" && value.category !== target.category) changes.category = value.category;
  return changes;
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
  const byKey = keyIndex(contacts);
  let updated = 0;
  let skipped = outcome.duplicates.filter((d) => d.of === "file").length;
  for (const d of outcome.duplicates) {
    if (d.of !== "existing") continue;
    const target = byKey.get(d.key);
    if (mode === "update" && target) {
      const changes = updateChanges(target, d.value, d.key);
      Object.assign(target, changes);
      updated++;
    } else skipped++;
  }
  const fresh = outcome.accepted.map((a) => ({ ...a.value, id: newId(), createdOn: today }));
  return { contacts: [...contacts, ...fresh], added: fresh.length, updated, skipped };
}

export interface DuplicatePair { a: Contact; b: Contact; reasons: string[] }

/** Pairs that share an email, a phone number, or a name and company. Uses buckets, so it stays fast on thousands of contacts. */
export function contactDuplicates(contacts: Contact[]): DuplicatePair[] {
  const buckets = new Map<string, number[]>();
  contacts.forEach((c, i) => {
    for (const k of contactKeys(c)) {
      if (k.endsWith("|")) continue; // name-only matches are an import rule, not enough to call two people the same
      const list = buckets.get(k);
      if (list) list.push(i); else buckets.set(k, [i]);
    }
  });
  const found = new Map<number, Map<number, Set<string>>>();
  for (const [k, list] of buckets) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const row = found.get(list[x]) ?? new Map<number, Set<string>>();
        found.set(list[x], row);
        const reasons = row.get(list[y]) ?? new Set<string>();
        row.set(list[y], reasons);
        reasons.add(KEY_REASON[k[0]]);
      }
    }
  }
  const out: DuplicatePair[] = [];
  for (const i of [...found.keys()].sort((p, q) => p - q)) {
    const row = found.get(i)!;
    for (const j of [...row.keys()].sort((p, q) => p - q)) {
      out.push({ a: contacts[i], b: contacts[j], reasons: REASON_ORDER.filter((r) => row.get(j)!.has(r)) });
    }
  }
  return out;
}

/** Existing contacts that look like the one being saved (ignoring `selfId`), with why. */
export function findMatches(contacts: Contact[], value: Identity, selfId?: string): { contact: Contact; reasons: string[] }[] {
  const mine = new Set(contactKeys(value).filter((k) => !k.endsWith("|")));
  if (mine.size === 0) return [];
  const out: { contact: Contact; reasons: string[] }[] = [];
  for (const c of contacts) {
    if (c.id === selfId) continue;
    const shared = contactKeys(c).filter((k) => mine.has(k));
    if (shared.length > 0) out.push({ contact: c, reasons: REASON_ORDER.filter((r) => shared.some((k) => KEY_REASON[k[0]] === r)) });
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
    lastContacted: a.lastContacted > b.lastContacted ? a.lastContacted : b.lastContacted,
    createdOn: a.createdOn < b.createdOn ? a.createdOn : b.createdOn,
  };
}

/** A contact is stale when it was last contacted this many days ago, or never. */
export const STALE_DAYS = 90;

export function isStale(c: Contact, today: string): boolean {
  return !c.lastContacted || daysBetween(c.lastContacted, today) >= STALE_DAYS;
}

export interface ContactSummary { total: number; duplicatePairs: number; missingEmail: number; missingPhone: number; stale: number }

export function summarize(contacts: Contact[], today: string, pairs: DuplicatePair[] = contactDuplicates(contacts)): ContactSummary {
  return {
    total: contacts.length,
    duplicatePairs: pairs.length,
    missingEmail: contacts.filter((c) => !c.email).length,
    missingPhone: contacts.filter((c) => !c.phone).length,
    stale: contacts.filter((c) => isStale(c, today)).length,
  };
}

export function contactsToCsv(contacts: Contact[]): string {
  return toCsv([
    ["Name", "Email", "Phone", "Company", "Category", "Notes", "Last contacted"],
    ...contacts.map((c) => [c.name, c.email, c.phone, c.company, c.category, c.notes, c.lastContacted]),
  ]);
}

/** A header-only CSV the user can fill in. */
export const TEMPLATE_CSV = toCsv([IMPORT_FIELDS.map((f) => f.label)]);
