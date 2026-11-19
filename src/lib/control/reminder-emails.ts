import { welcomeEmailSubject, welcomeMessage } from "./workspace";

/** The "your account is waiting" reminder: the welcome message with a friendly lead-in. Used by the Remind button and the daily job. */
export function signupReminderEmail(d: { clientName: string; ownerName: string; ownerEmail: string; inviteUrl: string }): { subject: string; text: string } {
  return {
    subject: `Reminder: ${welcomeEmailSubject(d.clientName)}`,
    text: `A friendly reminder: your AdFlo account is ready and waiting for you.\n\n${welcomeMessage({ clientName: d.clientName, ownerName: d.ownerName, ownerEmail: d.ownerEmail, inviteUrl: d.inviteUrl })}`,
  };
}
