import { invitationEmailSubject, invitationMessage } from "./workspace";

/** The "your invitation is waiting" reminder: the invitation with a friendly lead-in. Used by the Remind button and the daily job. */
export function signupReminderEmail(d: { clientName: string; ownerName: string; ownerEmail: string; inviteUrl: string }): { subject: string; text: string } {
  return {
    subject: `Reminder: ${invitationEmailSubject(d.clientName)}`,
    text: `A friendly reminder: your AdFlo invitation is waiting for you.\n\n${invitationMessage({ clientName: d.clientName, ownerName: d.ownerName, ownerEmail: d.ownerEmail, inviteUrl: d.inviteUrl })}`,
  };
}
