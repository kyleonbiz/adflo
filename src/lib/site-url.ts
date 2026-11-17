/** The address clients and staff are meant to use. Links that leave the app (emails, share and reset links) are built on it. */
export const CANONICAL_ORIGIN = "https://www.adflo.pro";

/**
 * The origin for a link that will be sent to someone. On the live production site it is always the canonical address, so a
 * staff member who happens to be on a *.vercel.app address never puts a login-protected link in a client's inbox.
 * `NEXT_PUBLIC_SITE_URL` overrides it. Everywhere else (local development, Vercel previews, tests) it is the address the
 * request came in on.
 */
export function siteOrigin(requestUrl: string, env: Record<string, string | undefined> = process.env): string {
  const set = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (set && /^https?:\/\/[^\s/]+$/.test(set)) return set;
  return env.VERCEL_ENV === "production" ? CANONICAL_ORIGIN : new URL(requestUrl).origin;
}
