import { brandedEmail } from "./layout";
import { CANONICAL_ORIGIN } from "@/lib/site-url";

/** The address support emails come from. Override with SUPPORT_FROM; it must be an alias of the SMTP account (see README). */
export const SUPPORT_FROM_DEFAULT = "AdFlo Support <support@adflo.pro>";
/** Where a new client request is announced. Override with SUPPORT_TO. */
export const SUPPORT_TO_DEFAULT = "support@adflo.pro";

const oneLine = (v: string) => v.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

/** The note to the support team when a client opens a request. Names and subjects are flattened to one line. */
export function newRequestEmail(d: { clientName: string; requesterEmail: string; subject: string; body: string; urgent: boolean; ticketId: string }): { subject: string; text: string; html: string } {
  const who = oneLine(d.clientName) || oneLine(d.requesterEmail) || "A client";
  const subject = oneLine(d.subject);
  const link = `${CANONICAL_ORIGIN}/control/support/${d.ticketId}`;
  return {
    subject: `${d.urgent ? "[Urgent] " : ""}Support request from ${who}: ${subject}`,
    html: brandedEmail({
      preheader: subject,
      headline: d.urgent ? "Urgent support request" : "New support request",
      intro: [d.body],
      panel: [["From", who], ["Email", oneLine(d.requesterEmail) || "unknown"], ["Subject", subject]],
      buttons: [{ label: "Open in Control center", url: link }],
      fine: ["Replying to this email goes to the person who asked."],
    }),
    text: [`${who} (${oneLine(d.requesterEmail)}) opened a support request${d.urgent ? " marked urgent" : ""}.`, "", subject, "", d.body, "", link].join("\n"),
  };
}

/** The note to the client when support answers. They read and answer it in AdFlo, under Help & Training. */
export function replyEmail(d: { subject: string; reply: string; ownerName?: string }): { subject: string; text: string; html: string } {
  const subject = oneLine(d.subject);
  const link = `${CANONICAL_ORIGIN}/app/help`;
  return {
    subject: `Re: ${subject}`,
    html: brandedEmail({
      preheader: "AdFlo support has replied to your request.",
      headline: "We replied to your request",
      intro: [`Hi ${oneLine(d.ownerName ?? "") || "there"},`, d.reply],
      panel: [["Your request", subject]],
      buttons: [{ label: "View and reply", url: link }],
      fine: ["You can also just reply to this email."],
    }),
    text: [`Hi ${oneLine(d.ownerName ?? "") || "there"},`, "", d.reply, "", `View and reply in AdFlo: ${link}`, "", "You can also just reply to this email.", "", "AdFlo support"].join("\n"),
  };
}
