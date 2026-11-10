import { formatDayLong } from "@/lib/dates";
import { parseRecipients } from "@/lib/forms/share";
import { daysLeft, expiryText, licenseStatus } from "@/lib/licenses/logic";
import { STATUS_LABEL } from "@/components/licenses/status";
import type { License } from "@/lib/licenses/types";
import { projectsReport } from "@/lib/projects/logic";
import type { Project } from "@/lib/projects/types";

export interface Draft { to: string; subject: string; body: string }

/** A link that opens the sender's email app with the message filled in. Email only. */
export function composeMailto(emails: string[], subject: string, body: string): string {
  return `mailto:${emails.map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`;
}

export { parseRecipients };

/** A short note about a license: what it is, who holds it, and when it expires. */
export function licenseDraft(license: License, today: string, to = ""): Draft {
  const left = daysLeft(license, today);
  const lines = [
    `License: ${license.name}`,
    license.issuer && `Issued by: ${license.issuer}`,
    license.number && `Number: ${license.number}`,
    license.holder && `Held by: ${license.holder}`,
    `Expires: ${formatDayLong(license.expiresOn)} (${expiryText(left).toLowerCase()})`,
    `Status: ${STATUS_LABEL[licenseStatus(license, today)]}`,
  ].filter(Boolean);
  return {
    to,
    subject: `${license.name}, expires ${formatDayLong(license.expiresOn)}`,
    body: ["Hi,", "", "Here are the details for this license:", "", ...lines, "", "Thank you."].join("\n"),
  };
}

/** A project status update for the client, using the same text as the downloadable report. */
export function projectDraft(project: Project, today: string, to = ""): Draft {
  return {
    to,
    subject: `Status update: ${project.name}`,
    body: [`Hi${project.client ? ` ${project.client}` : ""},`, "", "Here is where things stand:", "", projectsReport([project], today).trimEnd()].join("\n"),
  };
}

/** A blank note to a contact, greeting them by first name. */
export function contactDraft(contact: { name: string; email: string }): Draft {
  const first = contact.name.trim().split(/\s+/)[0] ?? "";
  return { to: contact.email, subject: "", body: `Hi${first ? ` ${first}` : ""},\n\n` };
}

/**
 * A note for sending a document. With a link, the recipient downloads it until `expires` (already
 * formatted for reading); without one, the sender attaches the file they downloaded themselves.
 */
export function documentDraft(name: string, link?: { url: string; expires: string }, to = ""): Draft {
  const lines = link
    ? ["Hi,", "", `Here is “${name}”:`, link.url, "", `The link stops working on ${link.expires}.`, "", "Thank you."]
    : ["Hi,", "", `Please find “${name}” attached.`, "", "Thank you."];
  return { to, subject: name, body: lines.join("\n") };
}
