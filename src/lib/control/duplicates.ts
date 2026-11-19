/**
 * Keeps two client records from describing the same customer. Pure helpers, shared by the create and edit routes (the
 * database has matching unique indexes as a backstop).
 */

/** Words that only describe the kind of company, so "Acme Roofing LLC" and "acme roofing, inc." are the same name. */
const COMPANY_SUFFIX = /\b(incorporated|inc|llc|l l c|ltd|limited|corp|corporation|co|company|pllc|llp|lp)\b/g;

/** A name reduced to what identifies it: lower case, no punctuation, no company suffix, single spaces. */
export function normalizeClientName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(COMPANY_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

interface ClientIdentity { id: string; name: string; owner_email: string | null }
type DuplicateField = "name" | "ownerEmail";
export interface Duplicate { field: DuplicateField; clientName: string; message: string }

/**
 * The first existing client that the candidate would duplicate, or null. `exceptId` skips the client being edited.
 * A name matches after normalizing; an owner email matches exactly (ignoring case), because one email can belong to only
 * one workspace owner.
 */
export function findDuplicateClient(existing: ClientIdentity[], candidate: { name?: string; ownerEmail?: string }, exceptId?: string): Duplicate | null {
  const name = candidate.name === undefined ? "" : normalizeClientName(candidate.name);
  const email = candidate.ownerEmail === undefined ? "" : normalizeEmail(candidate.ownerEmail);
  for (const c of existing) {
    if (c.id === exceptId) continue;
    if (name && normalizeClientName(c.name) === name) return { field: "name", clientName: c.name, message: `A client named "${c.name}" already exists.` };
    if (email && normalizeEmail(c.owner_email ?? "") === email) return { field: "ownerEmail", clientName: c.name, message: `${email} is already the owner of "${c.name}".` };
  }
  return null;
}
