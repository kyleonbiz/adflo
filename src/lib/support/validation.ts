import { TICKET_CATEGORIES, type TicketCategory } from "@/lib/control/types";

type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const text = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL, "").trim() : "");

/** A new request from the app: a subject, what is going on, and what kind of thing it is. */
export function parseSupportRequest(raw: unknown): Parsed<{ subject: string; body: string; category: TicketCategory }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const subject = text(r.subject).replace(/\s+/g, " ");
  if (subject.length < 1 || subject.length > 200) errors.subject = "Add a short subject (up to 200 characters).";
  const body = text(r.body);
  if (body.length < 1) errors.body = "Tell us what is going on.";
  else if (body.length > 5000) errors.body = "Keep it under 5,000 characters.";
  const category = r.category === undefined || r.category === "" ? "question" : r.category;
  if (!TICKET_CATEGORIES.includes(category as TicketCategory)) errors.category = "Choose what kind of request this is.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { subject, body, category: category as TicketCategory } };
}

/** A reply on a request, from either side. */
export function parseReply(raw: unknown): Parsed<{ body: string }> {
  const body = text((raw as { body?: unknown } | null)?.body);
  if (!body) return { ok: false, errors: { body: "Write a reply first." } };
  if (body.length > 5000) return { ok: false, errors: { body: "Keep replies under 5,000 characters." } };
  return { ok: true, value: { body } };
}

/** Close or reopen. */
export function parseClosed(raw: unknown): Parsed<{ closed: boolean }> {
  const closed = (raw as { closed?: unknown } | null)?.closed;
  return typeof closed === "boolean" ? { ok: true, value: { closed } } : { ok: false, errors: { closed: "Say whether to close or reopen." } };
}
