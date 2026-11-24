import { formatDayLong } from "@/lib/dates";
import { brandedEmail } from "@/lib/mail/layout";
import { addNote, dueFollowUps, owed, unansweredReminders } from "./follow-up";
import { docState } from "./logic";
import type { Vendor, VendorDocument } from "./types";

/**
 * The automatic vendor chase: when a workspace has switched it on, vendors who still owe a required document (a certificate of
 * insurance that is missing, expired or about to expire, a W-9, a license) are emailed on their behalf. The spacing and the stopping
 * point are the same as the manual follow-up: at most three emails, a week apart, then they count as gone quiet and the person
 * decides. It stops by itself the moment the document is marked received or the vendor's reply is logged.
 */
export const AUTO_CHASE_NAME = "AdFlo (automatic)";
/** One workspace's run is capped, so a mistake in someone's records can never become a flood of email. */
export const MAX_CHASES_PER_WORKSPACE = 25;

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
/** A name or title as one plain line: no line breaks or control characters that could add mail headers. */
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f<>"]+/g, " ").replace(/\s{2,}/g, " ").trim();

export interface ChaseTarget { vendor: Vendor; owes: VendorDocument[]; sent: number }

/** Vendors to email today: owing something, not yet at three unanswered emails, last emailed over a week ago (or never), and with an address. */
export function chaseTargets(vendors: Vendor[], today: string): ChaseTarget[] {
  return dueFollowUps(vendors, today)
    .filter((d) => d.state === "due" && EMAIL.test(d.vendor.email.trim()))
    .slice(0, MAX_CHASES_PER_WORKSPACE)
    .map(({ vendor, owes, sent }) => ({ vendor, owes, sent }));
}

function describe(d: VendorDocument, today: string): string {
  const state = docState(d, today);
  if (state === "missing") return "Not received yet";
  return state === "expired" ? `Expired ${formatDayLong(d.expiresOn!)}` : `Expires ${formatDayLong(d.expiresOn!)}`;
}

/** The email to the vendor, worded a little firmer each time, from the business's point of view. Replies go to the business. */
export function chaseEmail(v: Vendor, today: string, o: { business: string }): { subject: string; text: string; html: string } {
  const business = oneLine(o.business) || "our team";
  const owes = owed(v, today);
  const n = unansweredReminders(v).length;
  const who = oneLine(v.contactName) || "there";
  const opener = n === 0 ? `${business} keeps a file on each vendor it works with, and yours still needs the following:`
    : n === 1 ? `A friendly follow-up from ${business}. We still need:`
    : `This is our third request from ${business}. Your vendor file cannot be completed without:`;
  const subject = `${n > 0 ? "Reminder: " : ""}Documents ${business} still needs from ${oneLine(v.name) || "you"}`;
  const how = `Just reply to this email with the documents attached (a PDF or a clear photo is fine). Your reply goes straight to ${business}.`;
  const sentBy = `Sent by AdFlo on behalf of ${business}.`;
  return {
    subject,
    text: [`Hi ${who},`, "", opener, "", ...owes.map((d) => `  - ${oneLine(d.type)}: ${describe(d, today)}`), "", how, "", "Thank you", "", sentBy].join("\n"),
    html: brandedEmail({
      preheader: opener,
      headline: "Documents we still need",
      intro: [`Hi ${who},`, opener],
      panel: owes.map((d): [string, string] => [oneLine(d.type), describe(d, today)]),
      fine: [how, sentBy],
    }),
  };
}

/** Records on the vendor's file that this chase went out, so it shows who was emailed and when, and the next one waits a week. */
export function logAutoChase(v: Vendor, today: string, id: string): Vendor {
  const asked = owed(v, today).map((d) => oneLine(d.type)).join(", ");
  return addNote(v, { id, on: today, kind: "reminder", text: `Reminder ${unansweredReminders(v).length + 1} sent automatically for: ${asked}.`, by: AUTO_CHASE_NAME });
}

/** The same vendor without that note: used when the email could not be sent after the note was saved, so the next run tries again. */
export function withoutNote(v: Vendor, id: string): Vendor {
  return { ...v, activity: (v.activity ?? []).filter((n) => n.id !== id) };
}
