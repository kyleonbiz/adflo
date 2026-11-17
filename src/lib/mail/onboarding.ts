import "server-only";
import nodemailer from "nodemailer";
import { ONBOARDING_FROM_DEFAULT } from "./onboarding-email";

/** True when the server has the mailbox login it needs to send (the same SMTP account the demo form uses). */
export const onboardingMailReady = () => !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD);

/**
 * Sends one onboarding email from the onboarding@ alias (ONBOARDING_FROM). Gmail only keeps a custom From when that
 * address is set up under "Send mail as" for the SMTP account; otherwise it sends from the account itself. Replies go to
 * the alias too, so they land in the same mailbox. Throws if sending fails.
 */
export async function sendOnboardingEmail(m: { to: string; subject: string; text: string }): Promise<void> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) throw new Error("mail_not_configured");
  const from = process.env.ONBOARDING_FROM || ONBOARDING_FROM_DEFAULT;
  const mail = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  await mail.sendMail({ from, replyTo: from, to: m.to, subject: m.subject, text: m.text });
}
