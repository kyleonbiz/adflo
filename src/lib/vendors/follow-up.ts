import { daysBetween, formatDayLong } from "@/lib/dates";
import { docState } from "./logic";
import type { Vendor, VendorDocument, VendorNote } from "./types";

/** A vendor who still owes documents is reminded again after this many days. */
export const REMINDER_GAP_DAYS = 7;
/** This many reminders with no reply and the vendor counts as gone quiet. */
export const GHOSTED_AFTER = 3;

export type FollowUpState = "none" | "waiting" | "due" | "ghosted";

/** Required documents the vendor still owes: missing, expired or about to expire. Inactive and rejected vendors owe nothing. */
export function owed(v: Vendor, today: string): VendorDocument[] {
  if (v.status === "inactive") return [];
  return v.documents.filter((d) => d.required && docState(d, today) !== "valid");
}

export const notesOf = (v: Vendor): VendorNote[] => v.activity ?? [];

/** Reminders sent since the vendor last replied. */
export function unansweredReminders(v: Vendor): VendorNote[] {
  const log = notesOf(v);
  let lastReply = -1;
  log.forEach((n, i) => { if (n.kind === "reply") lastReply = i; });
  return log.slice(lastReply + 1).filter((n) => n.kind === "reminder");
}

export function followUpState(v: Vendor, today: string): FollowUpState {
  if (owed(v, today).length === 0) return "none";
  const sent = unansweredReminders(v);
  const last = sent[sent.length - 1];
  if (last && daysBetween(last.on, today) < REMINDER_GAP_DAYS) return "waiting";
  return sent.length >= GHOSTED_AFTER ? "ghosted" : "due";
}

/** Vendors to chase today: those who have never been reminded or whose last reminder has gone unanswered for a week. Ghosted ones come first. */
export function dueFollowUps(vendors: Vendor[], today: string): { vendor: Vendor; state: "due" | "ghosted"; sent: number; owes: VendorDocument[] }[] {
  const out: { vendor: Vendor; state: "due" | "ghosted"; sent: number; owes: VendorDocument[] }[] = [];
  for (const vendor of vendors) {
    const state = followUpState(vendor, today);
    if (state === "due" || state === "ghosted") out.push({ vendor, state, sent: unansweredReminders(vendor).length, owes: owed(vendor, today) });
  }
  return out.sort((a, b) => (a.state === b.state ? b.sent - a.sent || a.vendor.name.localeCompare(b.vendor.name) : a.state === "ghosted" ? -1 : 1));
}

/** The reminder to send, worded a little firmer each time. */
export function reminderEmail(v: Vendor, today: string): { to: string; subject: string; body: string } {
  const owes = owed(v, today);
  const n = unansweredReminders(v).length;
  const list = owes.map((d) => {
    const state = docState(d, today);
    return `  - ${d.type}${state === "missing" ? "" : state === "expired" ? ` (expired ${formatDayLong(d.expiresOn!)})` : ` (expires ${formatDayLong(d.expiresOn!)})`}`;
  });
  const who = v.contactName.trim() || "there";
  const opener = n === 0 ? "We are finishing your vendor file and still need the following:"
    : n === 1 ? "A follow-up on our earlier note. We still need:"
    : "This is our third request, and your file cannot be completed without:";
  return {
    to: v.email,
    subject: `${v.name}: documents we still need`,
    body: [`Hi ${who},`, "", opener, ...list, "", "Please reply with these attached, or tell us when we can expect them.", "", "Thank you"].join("\n"),
  };
}

export const mailtoLink = (m: { to: string; subject: string; body: string }) =>
  `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;

export function addNote(v: Vendor, note: Omit<VendorNote, "text"> & { text: string }): Vendor {
  const text = note.text.trim().slice(0, 500);
  if (!text) return v;
  return { ...v, activity: [...notesOf(v), { ...note, text }] };
}

/** Logs that a reminder went out, listing what it asked for, so the file shows exactly who was chased and when. */
export function logReminder(v: Vendor, today: string, id: string, by: string): Vendor {
  const asked = owed(v, today).map((d) => d.type).join(", ");
  return addNote(v, { id, on: today, kind: "reminder", text: `Reminder ${unansweredReminders(v).length + 1} sent for: ${asked}.`, by });
}
