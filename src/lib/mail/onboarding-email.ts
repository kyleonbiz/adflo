/** The address onboarding emails come from. Override with ONBOARDING_FROM; it must be an alias of the SMTP account (see README). */
export const ONBOARDING_FROM_DEFAULT = "AdFlo Onboarding <onboarding@adflo.pro>";

const oneLine = (v: string) => v.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

/** The email that carries a client's agreement link. Names are flattened to one line so they cannot add headers or lines. */
export function agreementEmail(d: { clientName: string; ownerName: string; link: string }): { subject: string; text: string } {
  const owner = oneLine(d.ownerName) || "there";
  return {
    subject: "Your AdFlo agreement",
    text: [
      `Hi ${owner},`,
      "",
      `Welcome to AdFlo. Before ${oneLine(d.clientName) || "your team"} gets started, please review and accept your agreement:`,
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
