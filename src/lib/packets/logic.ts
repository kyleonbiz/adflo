import { daysBetween, formatDayLong } from "@/lib/dates";

export type ItemKind = "form" | "document" | "signature";

export interface PacketItem {
  id: string;
  kind: ItemKind;
  label: string;
  /** For a form: the id of the form to fill out. */
  formId?: string;
}

export interface PacketTemplate {
  id: string;
  name: string;
  audience: "Employee" | "Vendor" | "Client";
  blurb: string;
  items: PacketItem[];
}

/** One packet handed to one person. `doneOn` is set as each item comes in. */
export interface Assignment {
  id: string;
  templateId: string;
  templateName: string;
  recipient: string;
  email: string;
  startedOn: string;
  items: (PacketItem & { doneOn: string | null })[];
}

const form = (id: string, label: string, formId: string): PacketItem => ({ id, kind: "form", label, formId });
const doc = (id: string, label: string): PacketItem => ({ id, kind: "document", label });
const sig = (id: string, label: string): PacketItem => ({ id, kind: "signature", label });

export const PACKETS: readonly PacketTemplate[] = [
  {
    id: "pk-employee", name: "New employee", audience: "Employee", blurb: "Everything a new hire hands in during their first week.",
    items: [
      form("e1", "New employee information", "pw-employee-onboarding"),
      form("e2", "Confidentiality acknowledgment", "pw-nda"),
      doc("e3", "Government-issued ID"),
      doc("e4", "Tax withholding form"),
      doc("e5", "Direct deposit details"),
      sig("e6", "Employee handbook acknowledgment"),
    ],
  },
  {
    id: "pk-vendor", name: "New vendor", audience: "Vendor", blurb: "What a supplier owes you before the first purchase.",
    items: [
      form("v1", "W-9 request", "pw-w9-request"),
      doc("v2", "Certificate of insurance"),
      doc("v3", "Business license copy"),
      sig("v4", "Vendor agreement"),
    ],
  },
  {
    id: "pk-client", name: "New client", audience: "Client", blurb: "Get a client set up and agreed on scope.",
    items: [
      form("c1", "Client intake", "pw-client-intake"),
      form("c2", "Engagement acknowledgment", "pw-engagement"),
      doc("c3", "Billing contact and payment details"),
      sig("c4", "Service agreement"),
    ],
  },
];

/** A packet days old with items still out is flagged, so a new hire or vendor does not sit half-finished. */
export const STALE_PACKET_DAYS = 7;

export function startPacket(t: PacketTemplate, recipient: string, email: string, today: string, id: string): Assignment {
  return { id, templateId: t.id, templateName: t.name, recipient: recipient.trim(), email: email.trim(), startedOn: today, items: t.items.map((i) => ({ ...i, doneOn: null })) };
}

export function toggleItem(a: Assignment, itemId: string, today: string): Assignment {
  return { ...a, items: a.items.map((i) => (i.id === itemId ? { ...i, doneOn: i.doneOn ? null : today } : i)) };
}

export function progress(a: Assignment): { done: number; total: number; percent: number } {
  const done = a.items.filter((i) => i.doneOn).length;
  return { done, total: a.items.length, percent: a.items.length === 0 ? 100 : Math.round((done / a.items.length) * 100) };
}

export const isComplete = (a: Assignment) => progress(a).done === a.items.length;

export function isStale(a: Assignment, today: string): boolean {
  return !isComplete(a) && daysBetween(a.startedOn, today) >= STALE_PACKET_DAYS;
}

/** Validation for starting a packet; returns what is wrong, or null. */
export function startProblem(recipient: string, email: string): string | null {
  if (recipient.trim().length < 2) return "Enter the person's name.";
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "That email address does not look right.";
  return null;
}

const KIND_TEXT: Record<ItemKind, string> = { form: "Fill out", document: "Collect", signature: "Signature" };

/** A printable checklist for the packet, to hand over or keep on file. */
export function packetText(a: Assignment): string {
  const p = progress(a);
  const lines = [`${a.templateName.toUpperCase()} PACKET`, `For ${a.recipient}${a.email ? ` (${a.email})` : ""}`, `Started ${formatDayLong(a.startedOn)}`, `${p.done} of ${p.total} done`, ""];
  for (const i of a.items) lines.push(`[${i.doneOn ? "x" : " "}] ${KIND_TEXT[i.kind]}: ${i.label}${i.doneOn ? ` (received ${formatDayLong(i.doneOn)})` : ""}`);
  return lines.join("\n") + "\n";
}

export function parseAssignments(raw: string): Assignment[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((a): a is Assignment =>
      !!a && typeof a.id === "string" && typeof a.recipient === "string" && typeof a.startedOn === "string" && typeof a.templateName === "string" &&
      Array.isArray(a.items) && a.items.every((i: { id?: unknown; label?: unknown }) => typeof i?.id === "string" && typeof i?.label === "string"));
  } catch { return []; }
}
