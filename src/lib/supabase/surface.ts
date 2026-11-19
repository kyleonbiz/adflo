/**
 * The Control center (staff) and the client app each keep their own sign-in, so one browser can be signed in to both at the
 * same time: a staff member testing as a client, or a client who is also staff. Each surface has its own session cookie.
 * Staff keep a separately named cookie; the client app keeps Supabase's default one, so existing client sessions stay valid.
 */
export type Surface = "app" | "control";

/** Set by the proxy on every request it handles, so server code knows which session to read. Never trusted from the browser. */
export const SURFACE_HEADER = "x-adflo-surface";

/** Which surface a path belongs to: the Control center and its API are staff; everything else is the client app. */
export function surfaceOfPath(path: string): Surface {
  return path === "/control" || path.startsWith("/control/") || path === "/api/control" || path.startsWith("/api/control/") ? "control" : "app";
}

export const STAFF_COOKIE = "adflo-staff-auth-token";
export const cookieOptionsFor = (surface: Surface) => (surface === "control" ? { name: STAFF_COOKIE } : undefined);
