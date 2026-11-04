import { CHECKLIST_STEPS, CLIENT_STATUSES, STAFF_ROLES, TICKET_PRIORITIES, TICKET_STATUSES, type ChecklistStep, type ClientStatus, type StaffRole, type TicketPriority, type TicketStatus } from "./types";

export interface ClientInput {
  name: string;
  status: ClientStatus;
  plan: string;
  seatsLimit: number;
  ownerName: string;
  ownerEmail: string;
  notes: string;
  priceOverrideCents: number | null;
  priceNote: string;
}

export type ParsedClient =
  | { ok: true; value: Partial<ClientInput> }
  | { ok: false; errors: Partial<Record<keyof ClientInput, string>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Control characters have no place in a name or a note (newlines are fine in notes).
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL, "").trim() : "");

/** Checks a client form (create or edit). `partial` skips fields that were not sent, for PATCH. */
export function parseClientInput(raw: unknown, partial = false): ParsedClient {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Partial<Record<keyof ClientInput, string>> = {};
  const out: Partial<ClientInput> = {};
  const has = (k: string) => !partial || k in r;

  if (has("name")) {
    const name = clean(r.name);
    if (name.length < 2 || name.length > 120) errors.name = "Enter the client's name (2 to 120 characters).";
    else out.name = name;
  }
  if (has("status")) {
    const status = r.status === undefined && !partial ? "trial" : r.status;
    if (!CLIENT_STATUSES.includes(status as ClientStatus)) errors.status = "Choose trial, active, suspended or cancelled.";
    else out.status = status as ClientStatus;
  }
  if (has("plan")) {
    const plan = r.plan === undefined && !partial ? "standard" : clean(r.plan);
    if (typeof plan !== "string" || plan.length < 1 || plan.length > 40) errors.plan = "Enter a plan name (up to 40 characters).";
    else out.plan = plan;
  }
  if (has("seatsLimit")) {
    const raw_ = r.seatsLimit === undefined && !partial ? 3 : r.seatsLimit;
    const n = typeof raw_ === "string" && raw_.trim() !== "" ? Number(raw_) : raw_;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 10000) errors.seatsLimit = "Seats must be a whole number from 0 to 10,000.";
    else out.seatsLimit = n;
  }
  if (has("ownerName")) {
    const v = clean(r.ownerName);
    if (v.length > 120) errors.ownerName = "Keep the owner's name under 120 characters.";
    else out.ownerName = v;
  }
  if (has("ownerEmail")) {
    const v = clean(r.ownerEmail).toLowerCase();
    if (v && (!EMAIL.test(v) || v.length > 254)) errors.ownerEmail = "Enter a valid email address.";
    else out.ownerEmail = v;
  }
  if (has("notes")) {
    const v = typeof r.notes === "string" ? r.notes.replace(CONTROL, "").trim() : "";
    if (v.length > 4000) errors.notes = "Keep notes under 4,000 characters.";
    else out.notes = v;
  }
  if (has("priceOverrideCents")) {
    const raw_ = r.priceOverrideCents;
    if (raw_ === undefined || raw_ === null || raw_ === "") out.priceOverrideCents = null;
    else {
      const cents = parseDollars(raw_);
      if (cents === null) errors.priceOverrideCents = "Enter a price like 79 or 79.50.";
      else out.priceOverrideCents = cents;
    }
  }
  if (has("priceNote")) {
    const v = clean(r.priceNote);
    if (v.length > 200) errors.priceNote = "Keep the note under 200 characters.";
    else out.priceNote = v;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: out };
}

/** "79", "79.5", "$1,200.00" → cents; anything else (negative, 3 decimals, text) → null. */
export function parseDollars(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 && v <= 1_000_000 ? Math.round(v * 100) : null;
  if (typeof v !== "string") return null;
  const m = /^\$?\s*(\d{1,7}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(v.trim());
  if (!m) return null;
  const cents = Number(m[1].replace(/,/g, "")) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
  return cents <= 100_000_000 ? cents : null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export function parsePlanInput(raw: unknown, partial = false): Parsed<{ name?: string; priceCents?: number; seatsIncluded?: number; active?: boolean }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const out: { name?: string; priceCents?: number; seatsIncluded?: number; active?: boolean } = {};
  if (!partial || "name" in r) { const n = clean(r.name); if (n.length < 1 || n.length > 40) errors.name = "Enter a plan name (up to 40 characters)."; else out.name = n; }
  if (!partial || "price" in r) { const c = parseDollars(r.price ?? 0); if (c === null) errors.price = "Enter a monthly price like 49 or 49.50."; else out.priceCents = c; }
  if (!partial || "seatsIncluded" in r) {
    const n = typeof r.seatsIncluded === "string" && r.seatsIncluded.trim() !== "" ? Number(r.seatsIncluded) : r.seatsIncluded ?? 3;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 10000) errors.seatsIncluded = "Seats must be a whole number from 0 to 10,000."; else out.seatsIncluded = n;
  }
  if ("active" in r) { if (typeof r.active !== "boolean") errors.active = "Active must be on or off."; else out.active = r.active; }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: out };
}

export function parseStaffInput(raw: unknown): Parsed<{ email: string; role: StaffRole; name: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const email = clean(r.email).toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) errors.email = "Enter a valid email address.";
  if (!STAFF_ROLES.includes(r.role as StaffRole)) errors.role = "Choose Owner, Support or Billing.";
  const name = clean(r.name);
  if (name.length > 80) errors.name = "Keep the name under 80 characters.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { email, role: r.role as StaffRole, name } };
}

export function parseChecklistInput(raw: unknown): Parsed<{ step: ChecklistStep; done: boolean }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const step = CHECKLIST_STEPS.find((s) => s.key === r.step)?.key;
  if (!step || typeof r.done !== "boolean") return { ok: false, errors: { step: "Unknown step." } };
  return { ok: true, value: { step, done: r.done } };
}

/** One readable line for an audit entry, e.g. "Status: trial → active". */
export function describeAudit(action: string, detail: Record<string, unknown>): string {
  if (action === "client.created") return `Created ${String(detail.name ?? "a client")} (${String(detail.plan ?? "")}, ${String(detail.seats_limit ?? "")} seats)`;
  if (action === "client.deleted") return `Deleted ${String(detail.name ?? "a client")}`;
  if (!action.startsWith("client.")) return describeGeneric(action, detail);
  const parts = Object.entries(detail).filter(([k]) => k !== "client_id").map(([k, v]) => {
    const label = k === "seats_limit" ? "Seats" : k === "owner_email" ? "Owner email" : k.charAt(0).toUpperCase() + k.slice(1);
    return Array.isArray(v) ? `${label}: ${String(v[0])} → ${String(v[1])}` : `${label} ${String(v)}`;
  });
  return parts.join(" · ") || "Updated";
}

const VERB: Record<string, string> = { insert: "added", update: "changed", delete: "removed" };

function describeGeneric(action: string, detail: Record<string, unknown>): string {
  const [entity, op] = action.split(".");
  const subject = String(detail.name ?? detail.email ?? detail.subject ?? detail.step ?? "");
  const rest = Object.entries(detail)
    .filter(([k]) => !["id", "user_id", "client_id", "name", "email", "subject", "step"].includes(k))
    .map(([k, v]) => `${k.replace(/_/g, " ")} ${String(v)}`).join(" · ");
  const head = `${entity.charAt(0).toUpperCase()}${entity.slice(1)} ${VERB[op] ?? op}`;
  return `${head}${subject ? ` ${subject}` : ""}${rest ? ` (${rest})` : ""}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const body_ = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL, "").trim() : "");

export function parseTicketInput(raw: unknown): Parsed<{ subject: string; body: string; clientId: string | null; priority: TicketPriority }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const subject = clean(r.subject);
  if (subject.length < 1 || subject.length > 200) errors.subject = "Enter a subject (up to 200 characters).";
  const body = body_(r.body);
  if (body.length > 5000) errors.body = "Keep the details under 5,000 characters.";
  const clientId = r.clientId === undefined || r.clientId === null || r.clientId === "" ? null : r.clientId;
  if (clientId !== null && !isUuid(clientId)) errors.clientId = "Choose a client from the list.";
  const priority = r.priority === undefined ? "normal" : r.priority;
  if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) errors.priority = "Choose low, normal or high.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { subject, body, clientId: clientId as string | null, priority: priority as TicketPriority } };
}

export function parseTicketPatch(raw: unknown): Parsed<{ status?: TicketStatus; priority?: TicketPriority; assignee?: string | null }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const out: { status?: TicketStatus; priority?: TicketPriority; assignee?: string | null } = {};
  if ("status" in r) { if (!TICKET_STATUSES.includes(r.status as TicketStatus)) errors.status = "Unknown status."; else out.status = r.status as TicketStatus; }
  if ("priority" in r) { if (!TICKET_PRIORITIES.includes(r.priority as TicketPriority)) errors.priority = "Unknown priority."; else out.priority = r.priority as TicketPriority; }
  if ("assignee" in r) { if (r.assignee === null || r.assignee === "") out.assignee = null; else if (isUuid(r.assignee)) out.assignee = r.assignee; else errors.assignee = "Choose a teammate."; }
  if (!Object.keys(out).length && !Object.keys(errors).length) errors.status = "Nothing to change.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: out };
}

export function parseNote(raw: unknown): Parsed<{ body: string }> {
  const body = body_((raw as { body?: unknown } | null)?.body);
  if (!body) return { ok: false, errors: { body: "Write a note first." } };
  if (body.length > 5000) return { ok: false, errors: { body: "Keep notes under 5,000 characters." } };
  return { ok: true, value: { body } };
}

export function parseResetEmail(raw: unknown): Parsed<{ email: string }> {
  const email = clean((raw as { email?: unknown } | null)?.email).toLowerCase();
  return EMAIL.test(email) && email.length <= 254 ? { ok: true, value: { email } } : { ok: false, errors: { email: "Enter a valid email address." } };
}
