import { NextResponse, type NextRequest } from "next/server";
import { canonicalControlUrl } from "@/lib/canonical-host";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Control center pages always live at the canonical address, whichever address was typed.
  const canonical = canonicalControlUrl(request.nextUrl);
  if (canonical) return NextResponse.redirect(canonical, 308);
  return updateSession(request);
}

export const config = {
  matcher: ["/app/:path*", "/control/:path*", "/api/dms/:path*", "/api/control/:path*", "/login", "/signup"],
};
