import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { AUTH_CALLBACK_RATE, checkRate, clientKey } from "@/lib/dms/server/rate-limit";

/** Completes email-confirmation / OAuth code exchange. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!checkRate(clientKey(request), AUTH_CALLBACK_RATE).ok) {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
