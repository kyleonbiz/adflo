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
  const from = process.env.ONBOARDING_FROM || ONBOARDING_FROM_DEFAULT;
  await sendMail({ from, replyTo: from, ...m });
}

/** Sends one invoice email. From BILLING_FROM when set (it must be an alias of the SMTP account), otherwise from the onboarding@ alias. */
export async function sendBillingEmail(m: { to: string; subject: string; text: string }): Promise<void> {
  const from = process.env.BILLING_FROM || process.env.ONBOARDING_FROM || ONBOARDING_FROM_DEFAULT;
  await sendMail({ from, replyTo: from, ...m });
}

/** Sends one plain-text email through the SMTP mailbox. Throws if the mailbox is not set up or sending fails. */
export async function sendMail(m: { from: string; replyTo?: string; to: string; subject: string; text: string }): Promise<void> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) throw new Error("mail_not_configured");
  const mail = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  await mail.sendMail({ from: m.from, replyTo: m.replyTo ?? m.from, to: m.to, subject: m.subject, text: m.text });
}
