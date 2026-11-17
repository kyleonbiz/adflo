import { siteOrigin } from "./site-url";

/**
 * On the live production site every Control center page belongs at the canonical address (https://www.adflo.pro/control).
 * Returns where to send a request that arrived on any other address (the bare domain, a *.vercel.app alias), or null when
 * it is already in the right place, is not a Control center page, or this is development or a Vercel preview.
 */
export function canonicalControlUrl(url: URL, env: Record<string, string | undefined> = process.env): URL | null {
  if (env.VERCEL_ENV !== "production") return null;
  if (url.pathname !== "/control" && !url.pathname.startsWith("/control/")) return null;
  const origin = siteOrigin(url.href, env);
  if (origin === url.origin) return null;
  return new URL(`${url.pathname}${url.search}`, origin);
}
