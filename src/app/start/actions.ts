"use server";

import { redirect } from "next/navigation";
import { TRIAL_DAYS } from "@/lib/billing/trial";
import { trialStaffNotice, trialWelcomeEmail, TRIAL_NOTIFY_DEFAULT } from "@/lib/mail/trial-email";
import { onboardingMailReady, sendMail, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { ONBOARDING_FROM_DEFAULT } from "@/lib/mail/onboarding-email";
import { CANONICAL_ORIGIN, siteOrigin } from "@/lib/site-url";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export interface StartState { error?: string }

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });

/** Starts the signed-in person's free trial (no workspace yet), tells AdFlo, emails them, and opens the app with sample data. */
export async function startTrial(_prev: StartState, form: FormData): Promise<StartState> {
  const company = String(form.get("company") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  if (company.length < 2 || company.length > 80) return { error: "Enter your company name (2 to 80 characters)." };
  if (name.length < 2 || name.length > 120) return { error: "Enter your name." };
  if (!getSupabaseEnv()) redirect("/app/overview");
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/start");
  const { data, error } = await supabase.rpc("start_trial", { p_company: company, p_name: name });
  if (error) {
    // The function's own messages are written for people; anything else is a plain failure.
    const known = ["company name", "already exists", "invitation", "already belongs", "Staff accounts", "already have a workspace"].some((s) => error.message.includes(s));
    return { error: known ? error.message : "We could not start your trial. Try again, or email support@adflo.pro." };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { trial_ends_at?: string } | null;
  // Only a brand-new trial sends mail (asking again returns the same trial, ending about 3 days from now).
  const endsAt = row?.trial_ends_at;
  const fresh = !!endsAt && new Date(endsAt).getTime() - Date.now() > (TRIAL_DAYS * 86_400 - 120) * 1000;
  if (fresh && onboardingMailReady()) {
    const origin = siteOrigin(CANONICAL_ORIGIN); // links in email point at the real site, never a preview address
    const email = auth.user.email ?? "";
    const endsOn = dateLabel(endsAt);
    const welcome = trialWelcomeEmail({ name, company, endsOn, appUrl: `${origin}/app/overview`, days: TRIAL_DAYS });
    const notice = trialStaffNotice({ name, email, company, endsOn, controlUrl: `${origin}/control` });
    // Mail problems never stop someone from starting their trial.
    await Promise.allSettled([
      email ? sendOnboardingEmail({ to: email, ...welcome }) : Promise.resolve(),
      sendMail({ from: process.env.ONBOARDING_FROM || ONBOARDING_FROM_DEFAULT, to: process.env.TRIAL_NOTIFY_TO || TRIAL_NOTIFY_DEFAULT, replyTo: email || undefined, ...notice }),
    ]);
  }
  redirect("/app/overview");
}
