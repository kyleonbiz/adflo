import "server-only";
import { brandedEmail } from "@/lib/mail/layout";
import { reminderMailReady, sendReminderEmail } from "@/lib/mail/send";
import { siteOrigin } from "@/lib/site-url";
import { ticketKey } from "@/lib/control/types";

/** The address support emails come from, and where a client's reply to one lands. Override with SUPPORT_FROM (an alias of the SMTP account). */
export const SUPPORT_FROM = () => process.env.SUPPORT_FROM || "AdFlo Support <support@adflo.pro>";

/** Where new requests and client replies are announced. Override with SUPPORT_NOTIFY_EMAIL. */
export const SUPPORT_INBOX = () => process.env.SUPPORT_NOTIFY_EMAIL || "support@adflo.pro";

const excerpt = (s: string) => (s.length > 1500 ? `${s.slice(0, 1500).trimEnd()}…` : s);

/** Tells a client that AdFlo replied to their request, with the reply and a link back to the conversation. */
export function replyToClientEmail(d: { ticketNo: number; subject: string; staffName: string; body: string; requestUrl: string }): { subject: string; text: string; html: string } {
  const key = ticketKey(d.ticketNo);
  const subject = `Re: [${key}] ${d.subject}`;
  return {
    subject,
    text: `${d.staffName} replied to your request ${key} (${d.subject}):\n\n${excerpt(d.body)}\n\nReply or see the whole conversation: ${d.requestUrl}\n`,
    html: brandedEmail({
      preheader: `${d.staffName} replied to ${key}`,
      headline: "You have a reply from AdFlo Support",
      intro: [`${d.staffName} replied to your request ${key}: ${d.subject}`, excerpt(d.body)],
      buttons: [{ label: "Open the conversation", url: d.requestUrl }],
      fine: ["Reply from your AdFlo account so everything stays in one place."],
    }),
  };
}

/** Tells the support inbox a client opened a request or replied. */
export function newActivityEmail(d: { kind: "new" | "reply"; ticketNo: number; subject: string; workspace: string; who: string; body: string; controlUrl: string }): { subject: string; text: string; html: string } {
  const key = ticketKey(d.ticketNo);
  const what = d.kind === "new" ? "New support request" : "New reply on a request";
  return {
    subject: `[${key}] ${what}: ${d.subject}`,
    text: `${what} ${key} from ${d.who}${d.workspace ? ` (${d.workspace})` : ""}\n${d.subject}\n\n${excerpt(d.body)}\n\n${d.controlUrl}\n`,
    html: brandedEmail({
      headline: what,
      panel: [["Ticket", key], ["From", d.who], ...(d.workspace ? [["Workspace", d.workspace] as [string, string]] : []), ["Subject", d.subject]],
      intro: [excerpt(d.body)],
      buttons: [{ label: "Open in Control center", url: d.controlUrl }],
    }),
  };
}

export const supportOrigin = (req: Request) => siteOrigin(req.url);

/** Sends a notification and never lets a mail problem affect the request that triggered it. */
export async function notifyQuietly(to: string, m: { subject: string; text: string; html: string }): Promise<void> {
  try {
    if (!to || !reminderMailReady()) return;
    await sendReminderEmail({ to, from: SUPPORT_FROM(), ...m });
  } catch {
    // The conversation is saved either way; the bell and the queue still show it.
  }
}
