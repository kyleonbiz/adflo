import { describe, expect, it } from "vitest";
import { supportBellItems } from "@/lib/support/alerts";
import type { MyTicket } from "@/lib/support/types";

const t = (o: Partial<MyTicket>): MyTicket => ({ id: "t1", ticketNo: 7, subject: "Cannot upload", category: "problem", status: "pending", createdAt: "2026-11-20T10:00:00Z", lastActivity: "2026-11-21T10:00:00Z", requesterName: "Alice", ...o });

describe("supportBellItems", () => {
  it("shows requests waiting on the client, linking to the conversation", () => {
    expect(supportBellItems([t({})])).toEqual([{ id: `support-t1-${Date.parse("2026-11-21T10:00:00Z")}`, area: "Support", severity: "warning", label: "AdFlo replied", text: "AF-7: Cannot upload", href: "/app/support/t1" }]);
  });
  it("ignores open and closed requests", () => {
    expect(supportBellItems([t({ status: "open" }), t({ id: "t2", status: "closed" })])).toEqual([]);
  });
  it("a newer reply is a new item, newest first", () => {
    const a = supportBellItems([t({}), t({ id: "t2", ticketNo: 8, lastActivity: "2026-11-22T10:00:00Z" })]);
    expect(a.map((i) => i.href)).toEqual(["/app/support/t2", "/app/support/t1"]);
    expect(supportBellItems([t({ lastActivity: "2026-11-23T10:00:00Z" })])[0].id).not.toBe(a[1].id);
  });
});
