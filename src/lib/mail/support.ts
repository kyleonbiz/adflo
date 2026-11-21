import "server-only";
import { sendMail } from "./onboarding";
import { SUPPORT_FROM_DEFAULT, SUPPORT_TO_DEFAULT } from "./support-email";

/**
 * Support email is a courtesy on top of the queue, so a failure never fails the request: the ticket is already saved and
 * shows in the Control center either way. Returns whether the email went out.
 */
export async function sendSupportMail(m: { to?: string; replyTo?: string; subject: string; text: string; html?: string }): Promise<boolean> {
  const from = process.env.SUPPORT_FROM || SUPPORT_FROM_DEFAULT;
  try {
    await sendMail({ from, replyTo: m.replyTo ?? from, to: m.to ?? (process.env.SUPPORT_TO || SUPPORT_TO_DEFAULT), subject: m.subject, text: m.text, html: m.html });
    return true;
  } catch {
    return false;
  }
}
