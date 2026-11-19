import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/dms/server/respond";

export async function POST(request: Request) {
  // Stops a third-party page from signing the user out with a hidden form post.
  if (!sameOrigin(request)) return new Response("Cross-origin request blocked.", { status: 403 });
  const form = await request.formData().catch(() => null);
  const to = form?.get("to");
  if (getSupabaseEnv()) {
    // Signing out of the Control center leaves any client-app sign-in alone, and the other way round.
    const supabase = await createServerSupabase(to === "control" ? "control" : "app");
    await supabase.auth.signOut({ scope: "local" }); // this session only: the same account may be signed in on the other side too
  }
  // Staff signing out of the Control center come back to the staff sign-in, not the client one.
  // An invited person who was signed in as someone else signs out and comes straight back to their sign-up.
  const next = form?.get("next");
  if (typeof next === "string" && /^\/signup\?email=[^\s&#]+$/.test(next)) return NextResponse.redirect(new URL(next, request.url), { status: 303 });
  return NextResponse.redirect(new URL(to === "control" ? "/control/login" : "/login", request.url), { status: 303 });
}
