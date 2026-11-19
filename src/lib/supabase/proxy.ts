import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import { cookieOptionsFor, SURFACE_HEADER, surfaceOfPath } from "./surface";

/**
 * Refreshes the Supabase session cookie and gates private routes.
 * `getUser()` validates the token with the auth server; it never trusts the cookie alone.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  // Tell the server code which session this request belongs to, whatever the browser claimed.
  const surface = surfaceOfPath(request.nextUrl.pathname);
  request.headers.set(SURFACE_HEADER, surface);
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookieOptions: cookieOptionsFor(surface),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/dms") || path.startsWith("/api/control");
  // With a database configured the staff screens always need sign-in. CONTROL_DEMO is deliberately not consulted here:
  // it only applies when no database is connected, and this code does not run then.
  const isStaffLogin = path === "/control/login";
  const isControl = (path === "/control" || path.startsWith("/control/")) && !isStaffLogin;
  const isPrivate = path === "/app" || path.startsWith("/app/") || isControl || isApi;

  if (!data.user && isPrivate) {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthenticated", message: "Please sign in." } },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    // Staff get their own sign-in; clients get the normal one.
    url.pathname = isControl ? "/control/login" : "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  // Someone already signed in is sent to the app, except when they open an invitation's sign-up for a different email:
  // the page then tells them to sign out first, instead of dropping them in an app that has no workspace for them.
  const invited = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const otherInvite = path === "/signup" && !!invited && invited !== (data.user?.email ?? "").toLowerCase();
  if (data.user && (path === "/login" || path === "/signup") && !otherInvite) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/overview";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
