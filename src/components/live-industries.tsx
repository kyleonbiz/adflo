"use client";

import type { Industry } from "@/lib/setup/types";
import { setLiveIndustries } from "@/lib/setup/types";

/** Hands the open industries (read on the server) to the setup pages and Addy in the browser. Renders nothing. */
export function LiveIndustries({ industries, children }: { industries: readonly Industry[]; children: React.ReactNode }) {
  // Set during render so the first paint of the picker already has the right list; setting the same list again is harmless.
  setLiveIndustries(industries);
  return <>{children}</>;
}
