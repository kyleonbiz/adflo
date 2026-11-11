import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * AdFlo is software, not a website: opening it goes to sign-in, then into the app. The marketing page lives at /landing.
 * With a database connected, a signed-in person is sent on to the app by the sign-in page itself.
 */
export default function RootPage() {
  redirect(getSupabaseEnv() ? "/app/overview" : "/login");
}
