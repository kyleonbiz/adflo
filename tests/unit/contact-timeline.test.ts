import { describe, expect, it } from "vitest";
import { contactTimeline } from "@/lib/profiles/logic";
import type { Invoice } from "@/lib/invoices/types";

const inv = (over: Partial<Invoice>) => ({ id: "i", number: "INV-1", status: "sent", issuedOn: "2026-10-01", paidOn: null, ...over }) as Invoice;

describe("contactTimeline", () => {
  it("lists additions, issued and paid invoices and last contact, newest first, skipping drafts", () => {
    const t = contactTimeline({ name: "Ann", createdOn: "2026-01-05", lastContacted: "2026-11-01" }, [
      inv({ status: "paid", paidOn: "2026-10-20" }), inv({ id: "d", number: "INV-2", status: "draft" }),
    ]);
    expect(t.map((e) => e.text)).toEqual(["Last contacted", "Invoice INV-1 paid", "Invoice INV-1 issued", "Ann added to Contacts"]);
  });
});
