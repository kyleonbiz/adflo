import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/site-url";

/** Only the public pages. The app, Control center, share links and API routes are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${CANONICAL_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${CANONICAL_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
