import { brandedEmail } from "./layout";

const oneLine = (v: string) => v.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

/** A sender name that is safe inside an email "From" header: no quotes, angle brackets or line breaks, and not too long. */
export function safeSenderName(name: string): string {
  return oneLine(name).replace(/["<>\\]/g, "").slice(0, 60).trim();
}

/**
 * The email that carries a share link. The person's own words are kept as written but cannot add headers: the subject and
 * names are flattened to one line, and the note is plain text.
 */
export function shareEmail(d: { senderName: string; fileName: string; url: string; expiresAtLabel: string; message?: string }): { subject: string; text: string; html: string } {
  const sender = safeSenderName(d.senderName) || "Someone";
  const file = oneLine(d.fileName) || "a document";
  const note = (d.message ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 1000);
  return {
    html: brandedEmail({
      preheader: `${sender} shared "${file}" with you.`,
      headline: "A document was shared with you",
      intro: [`${sender} shared a document with you.`, ...(note ? [note] : [])],
      panel: [["Document", file], ["Shared by", sender], ["Link works until", oneLine(d.expiresAtLabel)]],
      buttons: [{ label: "Download the document", url: d.url }],
      fine: ["Anyone who has this link can download the file, so please do not forward it."],
    }),
    subject: `${sender} shared "${file}" with you`,
    text: [
      `${sender} shared "${file}" with you.`,
      ...(note ? ["", note] : []),
      "",
      "Download it here:",
      d.url,
      "",
      `The link works until ${oneLine(d.expiresAtLabel)}. Anyone who has it can download the file, so please do not forward it.`,
      "",
      "Sent with AdFlo.",
    ].join("\n"),
  };
}

/** The address shared-document emails are sent from. Override with SHARE_FROM. It must be an alias of the SMTP mailbox (see README). */
const SHARE_FROM_DEFAULT = "AdFlo <documents@adflo.pro>";

/** The "From" header for a shared-document email: the person's name "via AdFlo", sent from the documents@ alias (SHARE_FROM). */
export function shareFromHeader(senderName: string, env: Record<string, string | undefined> = process.env): string {
  const configured = env.SHARE_FROM || SHARE_FROM_DEFAULT;
  const address = configured.match(/<([^<>\s]+)>/)?.[1] ?? configured.trim();
  const name = safeSenderName(senderName);
  return name ? `"${name} via AdFlo" <${address}>` : `AdFlo <${address}>`;
}
