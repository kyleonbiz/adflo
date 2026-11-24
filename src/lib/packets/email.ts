import { brandedEmail } from "@/lib/mail/layout";
import { outstanding, theirItems, type Assignment } from "./logic";

export type PacketEmailKind = "first" | "reminder";

export interface PacketEmailContext {
  /** The business sending it. */
  business: string;
  /** The link to fill out a form, or null when there is no usable one (the email then says to ask for it). */
  formLink: (formId: string) => string | null;
}

/** A name or title as one plain line: no line breaks or control characters that could add mail headers. */
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f<>"]+/g, " ").replace(/\s{2,}/g, " ").trim();

/**
 * The email that asks a person for their paperwork: forms to fill out (each with its own link), documents to send back by replying,
 * and things to sign. A reminder lists only what is still outstanding and gets firmer each time. Steps the business does itself are
 * never in it. `n` is the number of this reminder (1 to 3); it is ignored for the first email.
 */
export function packetEmail(a: Assignment, kind: PacketEmailKind, n: number, ctx: PacketEmailContext): { subject: string; text: string; html: string } {
  const business = oneLine(ctx.business) || "our team";
  const items = kind === "first" ? theirItems(a) : outstanding(a);
  const forms = items.filter((i) => i.kind === "form").map((i) => ({ label: oneLine(i.label), link: i.formId ? ctx.formLink(i.formId) : null }));
  const docs = items.filter((i) => i.kind === "document").map((i) => oneLine(i.label));
  const sigs = items.filter((i) => i.kind === "signature").map((i) => oneLine(i.label));
  const who = oneLine(a.recipient).split(" ")[0] || "there";

  const opener = kind === "first"
    ? `${business} needs a few things from you for your ${oneLine(a.templateName).toLowerCase()} paperwork.`
    : n <= 1 ? `A friendly reminder from ${business}: we are still waiting on the following for your ${oneLine(a.templateName).toLowerCase()} paperwork.`
    : n === 2 ? `A second reminder from ${business}. We still need:`
    : `A final reminder from ${business}. Your paperwork is not complete without:`;
  const subject = kind === "first" ? `${business}: paperwork to complete` : `${n >= 3 ? "Final reminder" : "Reminder"}: paperwork for ${business}`;
  const how = `Reply to this email with any documents attached (a PDF or a clear photo is fine). Replies go straight to ${business}.`;
  const sentBy = `Sent by AdFlo on behalf of ${business}.`;
  const signNote = "We will send these to you to sign, or have them ready for you to sign in person.";

  const text: string[] = [`Hi ${who},`, "", opener];
  if (forms.length) text.push("", "Forms to fill out (a few minutes each):", ...forms.map((f) => `  - ${f.label}: ${f.link ?? "ask us for the link"}`));
  if (docs.length) text.push("", "Documents to send back:", ...docs.map((d) => `  - ${d}`));
  if (sigs.length) text.push("", "To sign:", ...sigs.map((s) => `  - ${s}`), signNote);
  text.push("", how, "", "Thank you", "", sentBy);

  return {
    subject,
    text: text.join("\n"),
    html: brandedEmail({
      preheader: opener,
      headline: kind === "first" ? "Paperwork to complete" : "Paperwork still needed",
      intro: [`Hi ${who},`, opener],
      buttons: forms.filter((f): f is { label: string; link: string } => !!f.link).map((f) => ({ label: "Fill out the form", url: f.link, caption: f.label })),
      panel: [
        ...forms.filter((f) => !f.link).map((f): [string, string] => [f.label, "Ask us for the link"]),
        ...docs.map((d): [string, string] => [d, "Reply with it attached"]),
        ...sigs.map((s): [string, string] => [s, "To sign"]),
      ],
      fine: [...(sigs.length ? [signNote] : []), how, sentBy],
    }),
  };
}
