/**
 * Length of the free trial: a new account explores the app with sample data for this long, then is paused until it subscribes.
 * Three days unless NEXT_PUBLIC_TRIAL_DAYS says otherwise (a whole number from 1 to 30), so a longer trial can be tested, and undone,
 * by changing one setting. The sign-up copy, the welcome email and the length the database gives a new trial all follow it.
 */
export const TRIAL_DAYS = trialDays(process.env.NEXT_PUBLIC_TRIAL_DAYS);

export function trialDays(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 30 ? n : 3;
}

export interface TrialInfo { clientId: string; company: string; endsAt: string | null; paid: boolean; hasWorkspace: boolean }

/** What a self-serve account should see: its sample-data trial, the pay-to-continue page, or (once paid) a workspace of its own. */
export type TrialPhase = "trial" | "expired" | "paid" | "workspace";

export function trialPhase(t: TrialInfo, now: Date = new Date()): TrialPhase {
  if (t.hasWorkspace) return "workspace";
  if (t.paid) return "paid";
  return t.endsAt && new Date(t.endsAt).getTime() > now.getTime() ? "trial" : "expired";
}

/** Whole days left, rounded up (so the last day still reads "1 day left"), never below zero. */
export function trialDaysLeft(endsAt: string | null, now: Date = new Date()): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000));
}
