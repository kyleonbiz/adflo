import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/dms/server/respond";

export async function POST(request: Request) {
  // Stops a third-party page from signing the user out with a hidden form post.
  if (!sameOrigin(request)) return new Response("Cross-origin request blocked.", { status: 403 });
  if (getSupabaseEnv()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  // Staff signing out of the Control center come back to the staff sign-in, not the client one.
  const form = await request.formData().catch(() => null);
  const to = form?.get("to");
  // An invited person who was signed in as someone else signs out and comes straight back to their sign-up.
  const next = form?.get("next");
  if (typeof next === "string" && /^\/signup\?email=[^\s&#]+$/.test(next)) return NextResponse.redirect(new URL(next, request.url), { status: 303 });
  return NextResponse.redirect(new URL(to === "control" ? "/control/login" : "/login", request.url), { status: 303 });
}
