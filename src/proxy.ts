import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/app/:path*", "/control/:path*", "/api/dms/:path*", "/api/control/:path*", "/login", "/signup"],
};
