import { describe, expect, it } from "vitest";
import { canChase, chaseEmail } from "@/lib/invoices/chase";
import { sampleInvoices } from "../support/invoices-sample-data";
import type { Invoice } from "@/lib/invoices/types";

const T = "2026-10-26";
const base = sampleInvoices(T)[0];
const inv = (over: Partial<Invoice>): Invoice => ({ ...base, status: "sent", clientEmail: "pay@client.test", ...over });

describe("invoice chasing", () => {
  it("is offered only for sent invoices that are due today or late", () => {
    expect(canChase(inv({ dueOn: "2026-10-20" }), T)).toBe(true);
    expect(canChase(inv({ dueOn: T }), T)).toBe(true);
    expect(canChase(inv({ dueOn: "2026-10-30" }), T)).toBe(false);
    expect(canChase(inv({ dueOn: "2026-10-20", status: "paid" }), T)).toBe(false);
    expect(canChase(inv({ dueOn: "2026-10-20", status: "draft" }), T)).toBe(false);
  });
  it("words the email firmer the later it is, and addresses the client", () => {
    const today = chaseEmail(inv({ dueOn: T }), T);
    const late = chaseEmail(inv({ dueOn: "2026-10-22" }), T);
    const long = chaseEmail(inv({ dueOn: "2026-09-20" }), T);
    expect(today.to).toBe("pay@client.test");
    expect(today.subject).toMatch(/due today/);
    expect(late.subject).toMatch(/^Overdue/);
    expect(late.body).toMatch(/not yet received payment/);
    expect(long.body).toMatch(/36 days past/);
    for (const m of [today, late, long]) expect(m.body).toContain(base.number);
  });
});
