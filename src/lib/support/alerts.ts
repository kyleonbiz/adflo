import type { AttentionItem } from "@/lib/dashboard/logic";
import { ticketKey } from "@/lib/control/types";
import type { MyTicket } from "./types";

/**
 * What the client's bell shows about support: a request AdFlo has replied to and is now waiting on them for.
 * The id carries the last activity time, so a newer reply is "new" again even if the earlier one was seen.
 * Pure, so it is the thing to test.
 */
export function supportBellItems(tickets: MyTicket[]): AttentionItem[] {
  return tickets
    .filter((t) => t.status === "pending")
    .sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity))
    .map((t): AttentionItem => ({
      id: `support-${t.id}-${Date.parse(t.lastActivity)}`, area: "Support", severity: "warning", label: "AdFlo replied",
      text: `${ticketKey(t.ticketNo)}: ${t.subject}`, href: `/app/support/${t.id}`,
    }));
}
