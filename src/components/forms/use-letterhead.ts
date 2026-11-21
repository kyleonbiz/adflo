"use client";

import { useMemo } from "react";
import type { Letterhead } from "@/lib/documents/types";
import { useSettings } from "@/lib/settings/storage";
import { useSetupConfig } from "@/lib/setup/storage";

/** The business's name and contact details from Settings > Business profile, for the top of every document it makes. */
export function useLetterhead(): Letterhead {
  const setup = useSetupConfig();
  const { details } = useSettings();
  const name = setup?.business.name.trim() ?? "";
  return useMemo(() => ({ name, lines: [details.address, details.phone, details.email].map((l) => l.trim()).filter(Boolean) }), [name, details.address, details.phone, details.email]);
}
