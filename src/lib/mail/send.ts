import "server-only";
import { sendMail } from "./onboarding";

/** The address renewal and deadline reminders come from. Override with REMINDERS_FROM. */
export const REMINDERS_FROM_DEFAULT = "AdFlo <reminders@adflo.pro>";

/** True when the server can send reminder email: a Resend key (preferred) or the SMTP mailbox. */
export const reminderMailReady = () => !!process.env.RESEND_API_KEY || !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD);

/**
 * Sends one reminder email. With RESEND_API_KEY set it goes through Resend (a real sending service, for deliverability);
 * otherwise through the SMTP mailbox like the other emails. Throws if it cannot send, so the caller can count the failure.
 */
export async function sendReminderEmail(m: { to: string; subject: string; text: string; html?: string; /** Sender and reply-to, when not the reminders address (for example support replies). */ from?: string }): Promise<void> {
  const { from: custom, ...mail } = m;
  const from = custom || process.env.REMINDERS_FROM || REMINDERS_FROM_DEFAULT;
  const key = process.env.RESEND_API_KEY;
  if (!key) return sendMail({ from, replyTo: from, ...mail });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, reply_to: from, to: [mail.to], subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`resend_${res.status}`);
}
