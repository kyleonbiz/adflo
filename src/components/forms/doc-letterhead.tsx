"use client";

import { useEffect } from "react";
import { letterhead, setDocBusiness } from "@/lib/forms/doc-business";
import type { License } from "@/lib/licenses/types";
import { useStoredRecords } from "@/lib/records/storage";
import { useSettings } from "@/lib/settings/storage";
import { useSetupConfig } from "@/lib/setup/storage";

/** Renders nothing; keeps the letterhead for printed documents in step with setup, Settings and licenses. */
export function DocLetterhead() {
  const setup = useSetupConfig();
  const { details } = useSettings();
  const licenses = useStoredRecords<License>("licenses");
  const name = setup?.business.name ?? "";
  useEffect(() => { setDocBusiness(letterhead(name, details, licenses ?? [])); }, [name, details, licenses]);
  return null;
}
