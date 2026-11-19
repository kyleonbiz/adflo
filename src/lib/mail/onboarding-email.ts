import { brandedEmail } from "./layout";

/** The address onboarding emails come from. Override with ONBOARDING_FROM; it must be an alias of the SMTP account (see README). */
export const ONBOARDING_FROM_DEFAULT = "AdFlo Onboarding <onboarding@adflo.pro>";

const oneLine = (v: string) => v.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

/** The email that carries a client's agreement link. Names are flattened to one line so they cannot add headers or lines. */
export function agreementEmail(d: { clientName: string; ownerName: string; link: string; reminder?: boolean }): { subject: string; text: string; html: string } {
  const owner = oneLine(d.ownerName) || "there";
  const team = oneLine(d.clientName) || "your team";
  return {
    html: brandedEmail({
      preheader: "Review and accept your AdFlo agreement.",
      headline: d.reminder ? "Your agreement is still waiting" : "Your agreement is ready",
      intro: [`Hi ${owner},`, `${d.reminder ? "A friendly reminder: you have an agreement waiting." : "Welcome to AdFlo."} Before ${team} gets started, please review and accept your agreement.`],
      panel: [["Prepared for", team], ["Link works for", "30 days"]],
      buttons: [{ label: "Review and accept", url: d.link }],
      fine: ["The link is for you only. Type your full name and email on that page to accept."],
    }),
    subject: `${d.reminder ? "Reminder: " : ""}Your AdFlo agreement`,
    text: [
      `Hi ${owner},`,
      "",
      `${d.reminder ? "A friendly reminder: you have an agreement waiting." : "Welcome to AdFlo."} Before ${oneLine(d.clientName) || "your team"} gets started, please review and accept your agreement:`,
      "",
      d.link,
      "",
      "The link is for you only and works for 30 days. Type your full name and email on that page to accept.",
      "",
      "Questions? Just reply to this email.",
      "",
      "The AdFlo team",
    ].join("\n"),
  };
}

/** One email that carries several agreement links (for example Terms and Privacy Policy). One link falls back to the single-agreement email. */
export function agreementsEmail(d: { clientName: string; ownerName: string; items: { title: string; link: string }[]; reminder?: boolean }): { subject: string; text: string; html: string } {
  if (d.items.length === 1) return agreementEmail({ clientName: d.clientName, ownerName: d.ownerName, link: d.items[0].link, reminder: d.reminder });
  const owner = oneLine(d.ownerName) || "there";
  const team = oneLine(d.clientName) || "your team";
  return {
    html: brandedEmail({
      preheader: "Review and accept your AdFlo agreements.",
      headline: d.reminder ? "Your agreements are still waiting" : "Your agreements are ready",
      intro: [`Hi ${owner},`, `${d.reminder ? "A friendly reminder: you have agreements waiting." : "Welcome to AdFlo."} Before ${team} gets started, please review and accept each of these.`],
      panel: [["Prepared for", team], ["Agreements", String(d.items.length)], ["Links work for", "30 days"]],
      buttons: d.items.map((i) => ({ caption: oneLine(i.title), label: "Review and accept", url: i.link })),
      fine: ["Each link is for you only. Type your full name and email on each page to accept."],
    }),
    subject: `${d.reminder ? "Reminder: " : ""}Your AdFlo agreements`,
    text: [
      `Hi ${owner},`,
      "",
      `${d.reminder ? "A friendly reminder: you have agreements waiting." : "Welcome to AdFlo."} Before ${oneLine(d.clientName) || "your team"} gets started, please review and accept each of these:`,
      "",
      ...d.items.flatMap((i) => [oneLine(i.title), i.link, ""]),
      "Each link is for you only and works for 30 days. Type your full name and email on each page to accept.",
      "",
      "Questions? Just reply to this email.",
      "",
      "The AdFlo team",
    ].join("\n"),
  };
}

/** Where "a client accepted" notices go. Defaults to the onboarding@ alias, which lands in the same mailbox. Override with AGREEMENT_NOTIFY_TO. */
export const ACCEPTANCE_NOTIFY_DEFAULT = "onboarding@adflo.pro";

/** The notice staff get when a client accepts an agreement. Everything typed by the client is flattened to one line. */
export function acceptanceNoticeEmail(d: { clientName: string; title: string; version: number; acceptedName: string; acceptedEmail: string; acceptedAt: string; controlUrl: string }): { subject: string; text: string; html: string } {
  const client = oneLine(d.clientName) || "A client";
  const title = oneLine(d.title) || "an agreement";
  return {
    html: brandedEmail({
      preheader: `${client} accepted ${title}.`,
      headline: "An agreement was accepted",
      intro: [`${client} accepted ${title} (version ${d.version}).`],
      panel: [["Client", client], ["Agreement", `${title} (v${d.version})`], ["Accepted by", `${oneLine(d.acceptedName)} <${oneLine(d.acceptedEmail)}>`], ["When", oneLine(d.acceptedAt)]],
      buttons: [{ label: "Open in the Control center", url: d.controlUrl }],
    }),
    subject: `Agreement accepted: ${title} by ${client}`,
    text: [
      `${client} accepted ${title} (version ${d.version}).`,
      "",
      `Accepted by: ${oneLine(d.acceptedName)} <${oneLine(d.acceptedEmail)}>`,
      `When: ${oneLine(d.acceptedAt)}`,
      "",
      `See it in the Control center: ${d.controlUrl}`,
    ].join("\n"),
  };
}
