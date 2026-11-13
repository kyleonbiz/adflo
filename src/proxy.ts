import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { buildCsp, cspHeaderName, cspMode, newNonce } from "@/lib/csp";

/** Paths that need the Supabase session check; everything else only gets the CSP. */
const SESSION_PATHS = [/^\/app(\/|$)/, /^\/control(\/|$)/, /^\/api\/dms(\/|$)/, /^\/api\/control(\/|$)/, /^\/login$/, /^\/signup$/];

export async function proxy(request: NextRequest) {
  const mode = cspMode();
  const headerName = cspHeaderName(mode);
  const nonce = newNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV !== "production", supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, turnstile: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY });

  // Next reads the nonce from the request's CSP header and stamps it on its own scripts; the layout reads x-nonce.
  if (headerName) request.headers.set(headerName, csp);
  request.headers.set("x-nonce", nonce);

  const needsSession = SESSION_PATHS.some((re) => re.test(request.nextUrl.pathname));
  const response = needsSession ? await updateSession(request) : NextResponse.next({ request });
  if (headerName) response.headers.set(headerName, csp);
  return response;
}

export const config = {
  // Every page and API route except Next's static assets and image files.
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)" }],
};
