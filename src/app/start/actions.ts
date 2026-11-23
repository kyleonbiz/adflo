"use server";

import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export interface StartState { error?: string }

/** Creates the signed-in person's own company workspace (a trial on Core +), then sends them to the checkout page. */
export async function startWorkspace(_prev: StartState, form: FormData): Promise<StartState> {
  const company = String(form.get("company") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  if (company.length < 2 || company.length > 80) return { error: "Enter your company name (2 to 80 characters)." };
  if (name.length < 2 || name.length > 120) return { error: "Enter your name." };
  if (!getSupabaseEnv()) redirect("/app/overview");
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/start");
  const { error } = await supabase.rpc("self_serve_start", { p_company: company, p_name: name });
  if (error) {
    // The function's own messages are written for people; anything else is a plain failure.
    const known = ["company name", "already exists", "invitation", "already belongs", "Staff accounts"].some((s) => error.message.includes(s));
    return { error: known ? error.message : "We could not set up your workspace. Try again, or email support@adflo.pro." };
  }
  redirect("/app/checkout");
}
