import { brandedEmail } from "./layout";

/** Where "a new trial started" notices go. Defaults to sales@adflo.pro; set TRIAL_NOTIFY_TO to a dedicated alias. */
export const TRIAL_NOTIFY_DEFAULT = "sales@adflo.pro";

const oneLine = (v: string) => v.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

/** Sent to the person who just started a trial. */
export function trialWelcomeEmail(d: { name: string; company: string; endsOn: string; appUrl: string; days: number }): { subject: string; text: string; html: string } {
  const first = oneLine(d.name).split(/\s+/)[0] || "there";
  const company = oneLine(d.company);
  const text = [
    `Hi ${first},`, "",
    `Welcome to AdFlo, the administrative management platform. Your ${d.days}-day free trial for ${company} is under way and runs until ${d.endsOn}.`, "",
    "While you try it, the app is filled with sample data so you can look around: licenses and insurance, vendors, invoices, projects, equipment and documents.", "",
    `Open AdFlo: ${d.appUrl}`, "",
    "To keep going after the trial, subscribe for $99 a month. We then set up your own workspace and you carry on.", "",
    "Questions? Just reply to this email.", "", "The AdFlo team",
  ].join("\n");
  const html = brandedEmail({
    preheader: `Your ${d.days}-day AdFlo trial runs until ${d.endsOn}.`,
    headline: "Your free trial has started",
    intro: [`Hi ${first},`, `Welcome to AdFlo, the administrative management platform. Your ${d.days}-day free trial for ${company} runs until ${d.endsOn}. The app is filled with sample data so you can look around.`],
    panel: [["Company", company], ["Trial ends", d.endsOn]],
    steps: ["Open AdFlo and explore the sample records.", "Try Addy, your assistant, and the Dashboard.", "To keep going, subscribe for $99 a month. We set up your own workspace and you carry on."],
    buttons: [{ label: "Open AdFlo", url: d.appUrl }],
    fine: ["Questions? Just reply to this email."],
  });
  return { subject: `Your AdFlo free trial has started`, text, html };
}

/** Sent to AdFlo staff when someone starts a trial. */
export function trialStaffNotice(d: { name: string; email: string; company: string; endsOn: string; controlUrl: string }): { subject: string; text: string; html: string } {
  const lines: [string, string][] = [["Name", oneLine(d.name)], ["Email", oneLine(d.email)], ["Company", oneLine(d.company)], ["Trial ends", d.endsOn]];
  return {
    subject: `New AdFlo trial: ${oneLine(d.company)}`,
    text: ["A new free trial just started.", "", ...lines.map(([k, v]) => `${k}: ${v}`), "", `Control center: ${d.controlUrl}`].join("\n"),
    html: brandedEmail({
      preheader: `${oneLine(d.name)} started a trial.`,
      headline: "New free trial",
      intro: ["A new free trial just started."],
      panel: lines,
      buttons: [{ label: "Open the Control center", url: d.controlUrl }],
    }),
  };
}
