import { CLIENT_STATUSES, type ClientStatus } from "./types";

export interface ClientInput {
  name: string;
  status: ClientStatus;
  plan: string;
  seatsLimit: number;
  ownerName: string;
  ownerEmail: string;
  notes: string;
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
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: out };
}

/** One readable line for an audit entry, e.g. "Status: trial → active". */
export function describeAudit(action: string, detail: Record<string, unknown>): string {
  if (action === "client.created") return `Created ${String(detail.name ?? "a client")} (${String(detail.plan ?? "")}, ${String(detail.seats_limit ?? "")} seats)`;
  if (action === "client.deleted") return `Deleted ${String(detail.name ?? "a client")}`;
  const parts = Object.entries(detail).map(([k, v]) => {
    const label = k === "seats_limit" ? "Seats" : k === "owner_email" ? "Owner email" : k.charAt(0).toUpperCase() + k.slice(1);
    return Array.isArray(v) ? `${label}: ${String(v[0])} → ${String(v[1])}` : `${label} ${String(v)}`;
  });
  return parts.join(" · ") || "Updated";
}
