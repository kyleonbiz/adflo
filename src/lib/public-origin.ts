import { CANONICAL_ORIGIN } from "./site-url";

/**
 * The origin to put in a link built in the browser (confirmation and reset emails, share and invoice links). Anyone who
 * reaches the app on a *.vercel.app address still gets links on the real domain. Local development and Vercel previews keep
 * the address they are on, so they can be tested. `NEXT_PUBLIC_SITE_URL` overrides everything.
 */
export function publicOrigin(
  where: { origin: string; hostname: string } = window.location,
  env: Record<string, string | undefined> = { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV },
): string {
  const set = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (set && /^https?:\/\/[^\s/]+$/.test(set)) return set;
  if (where.hostname.endsWith(".vercel.app") && env.NEXT_PUBLIC_VERCEL_ENV !== "preview") return CANONICAL_ORIGIN;
  return where.origin;
}
