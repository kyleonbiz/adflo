import { daysBetween, formatDayLong } from "@/lib/dates";

export type ItemKind = "form" | "document" | "signature";

export interface PacketItem {
  id: string;
  kind: ItemKind;
  label: string;
  /** For a form: the id of the form to fill out. */
  formId?: string;
  /** "us" marks a step the business does itself (file a permit, remove access). It is never asked of the person, in emails or reminders. */
  by?: "us";
}

interface PacketTemplate {
  id: string;
  name: string;
  audience: "Client" | "Customer" | "Employee" | "Subcontractor";
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
  /** The day the packet was emailed to the person. Reminders only go to a packet that has been. */
  sentOn?: string;
  /** The days automatic reminders were emailed, oldest first. */
  remindedOn?: string[];
}

const form = (id: string, label: string, formId: string): PacketItem => ({ id, kind: "form", label, formId });
const doc = (id: string, label: string): PacketItem => ({ id, kind: "document", label });
const sig = (id: string, label: string): PacketItem => ({ id, kind: "signature", label });
const ours = (i: PacketItem): PacketItem => ({ ...i, by: "us" });

export const PACKETS: readonly PacketTemplate[] = [
  {
    id: "pk-client", name: "New client", audience: "Client", blurb: "Get a client set up and agreed on what is and is not included.",
    items: [
      form("c1", "Client intake", "pw-client-intake"),
      form("c2", "Scope of work confirmation", "pw-scope-confirmation"),
      form("c3", "Confidentiality acknowledgment", "pw-nda"),
      sig("c4", "Service agreement"),
    ],
  },
  {
    id: "pk-closeout", name: "Job closeout", audience: "Customer", blurb: "What a contractor hands over, and gets signed, when a job is finished.",
    items: [
      form("j1", "Certificate of completion", "pw-completion"),
      form("j2", "Warranty certificate", "pw-warranty"),
      ours(doc("j3", "Final inspection sign-off")),
      ours(doc("j4", "Permit closed out")),
      sig("j5", "Owner acceptance"),
    ],
  },
  {
    id: "pk-hire", name: "New hire", audience: "Employee", blurb: "Safety, equipment and emergency details for a new team member. Payroll and tax forms stay in your payroll system.",
    items: [
      form("h1", "Safety orientation acknowledgment", "pw-safety-orientation"),
      form("h2", "Equipment and key issue acknowledgment", "pw-equipment-issue"),
      form("h3", "Emergency contact", "pw-emergency-contact"),
      form("h4", "Confidentiality acknowledgment", "pw-nda"),
      doc("h5", "Copy of any license or certification the job needs"),
      sig("h6", "Employee handbook acknowledgment"),
    ],
  },
  {
    id: "pk-sub", name: "New subcontractor", audience: "Subcontractor", blurb: "What a subcontractor shows before starting work for you.",
    items: [
      form("s1", "Subcontractor compliance record", "pw-sub-compliance"),
      doc("s2", "W-9"),
      doc("s3", "Certificate of insurance (with you as certificate holder)"),
      doc("s4", "Copy of license"),
      form("s5", "Confidentiality acknowledgment", "pw-nda"),
      sig("s6", "Subcontract agreement"),
    ],
  },
  {
    id: "pk-offboard", name: "Offboarding", audience: "Employee", blurb: "Get property back and access closed when someone leaves.",
    items: [
      form("o1", "Return of company property", "pw-property-return"),
      ours(doc("o2", "Keys, codes and equipment accounted for")),
      ours(doc("o3", "Accounts and access removed")),
      ours(doc("o4", "Final records filed")),
      sig("o5", "Exit acknowledgment"),
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

// --- Emailing a packet, and reminding about it -------------------------------------------------------------

/** After a packet is emailed, the first reminder is this many days later, and then one a week, up to three. Then it is the owner's call. */
export const FIRST_REMINDER_AFTER_DAYS = 3;
export const REMINDER_GAP_DAYS = 7;
export const MAX_PACKET_REMINDERS = 3;

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
export const hasEmail = (a: Pick<Assignment, "email">) => EMAIL.test(a.email.trim());

/** The steps the person has to do themselves: everything not marked as the business's own. */
export const theirItems = (a: Assignment) => a.items.filter((i) => i.by !== "us");
/** Their steps that have not come in yet. */
export const outstanding = (a: Assignment) => theirItems(a).filter((i) => !i.doneOn);

/**
 * True when an automatic reminder should go to the person today: the packet was emailed, something of theirs is still out, they have a
 * usable email, fewer than three reminders have gone, and enough days have passed since it was emailed (or since the last reminder).
 */
export function reminderDue(a: Assignment, today: string): boolean {
  if (!a.sentOn || !hasEmail(a) || outstanding(a).length === 0) return false;
  const reminded = a.remindedOn ?? [];
  if (reminded.length >= MAX_PACKET_REMINDERS) return false;
  const last = reminded[reminded.length - 1];
  return last ? daysBetween(last, today) >= REMINDER_GAP_DAYS : daysBetween(a.sentOn, today) >= FIRST_REMINDER_AFTER_DAYS;
}

/** Reminders have run out and things are still outstanding: the person has gone quiet and it is up to the owner. */
export const wentQuiet = (a: Assignment): boolean => (a.remindedOn?.length ?? 0) >= MAX_PACKET_REMINDERS && outstanding(a).length > 0;
