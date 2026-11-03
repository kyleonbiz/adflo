import type { AttentionItem } from "./logic";
import type { NotificationPrefs } from "@/lib/settings/types";

/**
 * Applies the choices made in Settings > Notifications to the attention list: switched-off kinds do not
 * appear in the bell. (The dashboard still shows everything, because it is the full picture.)
 */
export function applyPrefs(items: AttentionItem[], prefs: NotificationPrefs): AttentionItem[] {
  return items.filter((i) => {
    if (i.area === "Licenses") return prefs.enabled.renewals;
    if (i.area === "Invoices") return prefs.enabled.overdueInvoices;
    if (i.area === "Admin" && i.text.includes("waiting for approval")) return prefs.enabled.approvals;
    return true;
  });
}

/** Item ids that were not there the last time the bell was opened. */
export const unseen = (items: { id: string }[], seen: string[]): Set<string> => new Set(items.filter((i) => !seen.includes(i.id)).map((i) => i.id));

/** Remembers what was on show, forgetting anything that has gone away so the saved list stays small. */
export const rememberSeen = (items: { id: string }[]): string[] => items.map((i) => i.id).slice(0, 200);

export function parseSeen(raw: string): string[] {
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  } catch { return []; }
}
