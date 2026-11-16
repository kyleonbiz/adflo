import { safeNext } from "@/lib/safe-redirect";

/** Where to go after staff sign in: only inside the Control center, never anywhere else (no open redirects). */
export function staffNext(value: string | null | undefined): string {
  const path = safeNext(value, "/control");
  const pathOnly = path.split(/[?#]/)[0];
  return pathOnly === "/control" || pathOnly.startsWith("/control/") ? (pathOnly === "/control/login" ? "/control" : path) : "/control";
}

/** The sign-in address for a staff page, remembering where they were going. */
export const staffLoginHref = (nextPath: string): string => `/control/login?next=${encodeURIComponent(nextPath)}`;
