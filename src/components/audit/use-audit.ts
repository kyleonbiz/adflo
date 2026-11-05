"use client";

import { useCallback } from "react";
import { useCurrentUserName } from "@/components/current-user";
import type { AuditArea } from "@/lib/audit/logic";
import { appendAudit } from "@/lib/audit/storage";

/**
 * Returns `audit(verb, what, area, href)`: records that the signed-in person did something, with the time.
 * Call it where the action happens, for example `audit("created", "invoice INV-12", "Invoices", "/app/invoices")`.
 */
export function useAudit() {
  const by = useCurrentUserName();
  return useCallback(
    (verb: string, what: string, area: AuditArea, href: string) =>
      appendAudit({ id: `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, by, verb, what, area, href, at: new Date().toISOString() }),
    [by],
  );
}
