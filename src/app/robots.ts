import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in screens and one-time links carry private data and are of no use in search results.
      disallow: ["/app", "/control", "/api", "/auth", "/share", "/agreement", "/form", "/invoice", "/login", "/signup", "/forgot-password", "/reset-password"],
    },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}
