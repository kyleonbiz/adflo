import { brandedEmail } from "@/lib/mail/layout";

export type TrialNudge = "ending" | "ended";

/** The "trial ends soon" email goes out once the trial has this many hours or fewer left (a daily job always lands in the window once). */
export const ENDING_WITHIN_HOURS = 30;
/** The "trial ended" email goes out for a trial that ended up to this many days ago, then never. */
export const ENDED_WITHIN_DAYS = 4;

export interface TrialClient {
  selfServe: boolean;
  status: string;
  workspaceId: string | null;
  hasSubscription: boolean;
  endsAt: string | null;
  endingSentAt: string | null;
  endedSentAt: string | null;
}

/**
 * Which email, if any, a self-serve trial is due today: a nudge before it ends and one after it has. Only an unpaid trial that has
 * no workspace yet, and each email only once. Pure.
 */
export function dueNudge(c: TrialClient, now: Date = new Date()): TrialNudge | null {
  if (!c.selfServe || c.status !== "trial" || c.workspaceId || c.hasSubscription || !c.endsAt) return null;
  const ends = Date.parse(c.endsAt);
  if (Number.isNaN(ends)) return null;
  const hoursLeft = (ends - now.getTime()) / 3_600_000;
  if (hoursLeft > 0) return hoursLeft <= ENDING_WITHIN_HOURS && !c.endingSentAt ? "ending" : null;
  return -hoursLeft <= ENDED_WITHIN_DAYS * 24 && !c.endedSentAt ? "ended" : null;
}

const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f<>]+/g, " ").replace(/\s{2,}/g, " ").trim();

/** The email itself. It says plainly what happens to the account and links to the page where they continue. */
export function trialNudgeEmail(kind: TrialNudge, d: { company: string; ownerName: string; continueUrl: string }): { subject: string; text: string; html: string } {
  const who = oneLine(d.ownerName).split(" ")[0] || "there";
  const company = oneLine(d.company) || "your company";
  const ending = kind === "ending";
  const subject = ending ? `Your AdFlo trial ends soon` : `Your AdFlo trial has ended`;
  const intro = ending
    ? [`Hi ${who},`, `Your free AdFlo trial for ${company} ends soon. When it does, the account is paused until you subscribe.`, "Subscribe now and AdFlo sets up your real workspace straight away, ready for your own records."]
    : [`Hi ${who},`, `Your free AdFlo trial for ${company} has ended, so the account is paused.`, "When you subscribe, AdFlo sets up your real workspace straight away. Questions first? Just reply to this email."];
  const fine = "AdFlo is an administrative management platform for contractors and property managers: records, paperwork, compliance deadlines and equipment in one place, alongside your accounting and payroll software.";
  return {
    subject,
    text: [...intro, "", `Continue with AdFlo: ${d.continueUrl}`, "", fine].join("\n"),
    html: brandedEmail({ preheader: intro[1], headline: ending ? "Your trial ends soon" : "Your trial has ended", intro: intro.slice(0), buttons: [{ label: "Continue with AdFlo", url: d.continueUrl }], fine: [fine] }),
  };
}
