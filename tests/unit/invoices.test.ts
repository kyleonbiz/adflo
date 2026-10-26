import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  invoiceAlerts, invoiceState, invoicesToCsv, markPaid, markSent, needsAttention, nextInvoiceNumber,
  nextOverdueNotice, nextRecurringInvoice, nextReminder, hasNextInvoice, invoiceTotals, describeItems, generateInvoiceNumber, paymentDateError, reopen, voidInvoice, summarize, formatMoney, daysOverdue,
} from "@/lib/invoices/logic";
import { sampleInvoices } from "@/lib/invoices/sample-data";
import type { Invoice } from "@/lib/invoices/types";
import { invoiceFormSchema, parseDollars } from "@/lib/invoices/validation";

const TODAY = "2026-10-25";

const inv = (over: Partial<Invoice> = {}): Invoice => ({
  id: "x", number: "INV-0001", client: "Acme", clientEmail: "", description: "", amountCents: 10_000,
  items: [{ description: "Work", qty: 1, rateCents: 10_000 }], taxRate: 0, paymentMethods: ["Cash"],
  sender: { name: "Me LLC", address: "Nashville, TN", phone: "", email: "" },
  issuedOn: "2026-10-01", dueOn: "2026-10-31", status: "sent", paidOn: null,
  recurrence: "none", reminderDays: [7, 1], notes: "", ...over,
});

describe("invoiceState", () => {
  it("only sent invoices age; other statuses are fixed", () => {
    expect(invoiceState(inv({ status: "draft", dueOn: addDays(TODAY, -90) }), TODAY)).toBe("draft");
    expect(invoiceState(inv({ status: "paid", dueOn: addDays(TODAY, -90) }), TODAY)).toBe("paid");
    expect(invoiceState(inv({ status: "void", dueOn: addDays(TODAY, -90) }), TODAY)).toBe("void");
  });
  it("walks from upcoming to overdue as the due date passes", () => {
    expect(invoiceState(inv({ dueOn: addDays(TODAY, 8) }), TODAY)).toBe("upcoming");
    expect(invoiceState(inv({ dueOn: addDays(TODAY, 7) }), TODAY)).toBe("due_soon");
    expect(invoiceState(inv({ dueOn: TODAY }), TODAY)).toBe("due_today");
    expect(invoiceState(inv({ dueOn: addDays(TODAY, -1) }), TODAY)).toBe("overdue");
  });
  it("counts days overdue for sent invoices only", () => {
    expect(daysOverdue(inv({ dueOn: addDays(TODAY, -5) }), TODAY)).toBe(5);
    expect(daysOverdue(inv({ dueOn: addDays(TODAY, -5), status: "paid" }), TODAY)).toBe(0);
    expect(daysOverdue(inv({ dueOn: addDays(TODAY, 5) }), TODAY)).toBe(0);
  });
});

describe("invoiceAlerts", () => {
  it("warns when slightly late and goes critical at two weeks", () => {
    expect(invoiceAlerts(inv({ dueOn: addDays(TODAY, -3) }), TODAY)).toEqual([{ severity: "warning", message: "3 days overdue." }]);
    expect(invoiceAlerts(inv({ dueOn: addDays(TODAY, -1) }), TODAY)[0].message).toBe("1 day overdue.");
    expect(invoiceAlerts(inv({ dueOn: addDays(TODAY, -14) }), TODAY)[0].severity).toBe("critical");
  });
  it("is quiet for paid, draft and far-off invoices", () => {
    expect(invoiceAlerts(inv({ status: "paid", dueOn: addDays(TODAY, -30) }), TODAY)).toEqual([]);
    expect(invoiceAlerts(inv({ dueOn: addDays(TODAY, 40) }), TODAY)).toEqual([]);
    expect(invoiceAlerts(inv({ dueOn: TODAY }), TODAY)[0].message).toBe("Due today.");
  });
});

describe("reminders", () => {
  it("finds the next reminder before the due date", () => {
    expect(nextReminder(inv({ dueOn: addDays(TODAY, 10) }), TODAY)).toEqual({ on: addDays(TODAY, 3), daysBefore: 7 });
    expect(nextReminder(inv({ dueOn: addDays(TODAY, 3) }), TODAY)).toEqual({ on: addDays(TODAY, 2), daysBefore: 1 });
  });
  it("has none once passed, or for invoices that are not sent", () => {
    expect(nextReminder(inv({ dueOn: TODAY }), TODAY)).toBeNull();
    expect(nextReminder(inv({ dueOn: addDays(TODAY, 10), status: "draft" }), TODAY)).toBeNull();
  });
  it("repeats overdue notices weekly after the due date", () => {
    expect(nextOverdueNotice(inv({ dueOn: addDays(TODAY, -3) }), TODAY)).toBe(addDays(TODAY, 4));
    expect(nextOverdueNotice(inv({ dueOn: addDays(TODAY, -7) }), TODAY)).toBe(addDays(TODAY, 7));
    expect(nextOverdueNotice(inv({ dueOn: addDays(TODAY, 3) }), TODAY)).toBeNull();
  });
});

describe("recurring invoices", () => {
  it("numbers the next invoice and keeps the payment terms", () => {
    const next = nextRecurringInvoice(inv({ issuedOn: "2026-01-31", dueOn: "2026-02-14", recurrence: "monthly", status: "paid", paidOn: "2026-02-01" }), [], "n1")!;
    expect(next).toMatchObject({ id: "n1", number: "INV-0002", issuedOn: "2026-02-28", dueOn: "2026-03-14", status: "draft", paidOn: null });
  });
  it("returns null for one-time invoices", () => {
    expect(nextRecurringInvoice(inv(), [], "n1")).toBeNull();
  });
  it("skips invoice numbers already taken and keeps zero padding", () => {
    expect(nextInvoiceNumber("INV-0041", ["INV-0042", "INV-0043"])).toBe("INV-0044");
    expect(nextInvoiceNumber("A9", [])).toBe("A10");
    expect(nextInvoiceNumber("Retainer", ["Retainer-2"])).toBe("Retainer-3");
  });
  it("advances weekly, quarterly and yearly series", () => {
    const base = inv({ issuedOn: "2026-10-25", dueOn: "2026-11-24" });
    expect(nextRecurringInvoice({ ...base, recurrence: "weekly" }, [], "a")!.issuedOn).toBe("2026-11-01");
    expect(nextRecurringInvoice({ ...base, recurrence: "quarterly" }, [], "a")!.issuedOn).toBe("2027-01-25");
    expect(nextRecurringInvoice({ ...base, recurrence: "yearly" }, [], "a")!.dueOn).toBe("2027-11-24");
  });
});

describe("status changes", () => {
  it("marks sent and paid", () => {
    expect(markSent(inv({ status: "draft" })).status).toBe("sent");
    expect(markPaid(inv(), TODAY)).toMatchObject({ status: "paid", paidOn: TODAY });
  });
});

describe("summary and attention list", () => {
  const all = sampleInvoices(TODAY);
  it("totals outstanding, overdue and paid-this-month amounts", () => {
    expect(summarize(all, TODAY)).toEqual({
      outstandingCents: 185_000 + 62_500 + 240_000 + 98_000,
      overdueCents: 185_000 + 62_500,
      overdueCount: 2,
      paidThisMonthCents: 185_000,
      dueSoonCount: 1,
    });
  });
  it("lists overdue first, then due soon, ignoring drafts, paid and void", () => {
    expect(needsAttention(all, TODAY).map((i) => i.id)).toEqual(["inv-1", "inv-2", "inv-3"]);
  });
  it("does not count a payment from a previous month", () => {
    expect(summarize([inv({ status: "paid", paidOn: "2026-09-30" })], TODAY).paidThisMonthCents).toBe(0);
  });
});

describe("csv export", () => {
  it("writes a header, quotes awkward values and neutralises spreadsheet formulas", () => {
    const csv = invoicesToCsv([inv({ client: 'Smith, "Bob"', description: "=HYPERLINK(\"http://evil\")" })], TODAY);
    const [header, row] = csv.trimEnd().split("\r\n");
    expect(header).toBe("Number,Client,Description,Amount,Issued,Due,Status,Days overdue,Paid on,Recurrence");
    expect(row).toContain('"Smith, ""Bob"""');
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(row).toContain(",100.00,");
    expect(row).toContain(",sent,"); // stored status, matching the UI, not the computed state
  });
});

describe("money and form validation", () => {
  it("formats cents", () => {
    expect(formatMoney(125_050)).toBe("$1,250.50");
  });
  it.each([
    ["1250", 125_000], ["1,250.5", 125_050], ["$99.99", 9_999], ["0.01", 1],
  ])("parses %s", (text, cents) => expect(parseDollars(text)).toBe(cents));
  it.each(["", "abc", "1.234", "-5", "1,25", "1e3", "12 50"])("rejects %j", (text) => expect(parseDollars(text)).toBeNull());

  const valid = {
    number: "INV-9", fromName: "Me LLC", fromAddress: "Nashville, TN", fromPhone: "", fromEmail: "",
    client: "Acme Corp", clientEmail: "", items: [{ description: "File reorg", qty: "1", rate: "44.87" }, { description: "x2", qty: "12", rate: "2.00" }],
    taxRate: "0.925", issuedOn: "2026-10-01", dueOn: "2026-10-31", paymentMethods: "Cash\nCheck",
    recurrence: "none", reminderDays: "7, 1", notes: "",
  };
  it("accepts a valid form and allows no reminders", () => {
    expect(invoiceFormSchema.parse(valid)).toMatchObject({
      items: [{ description: "File reorg", qty: 1, rate: 4_487 }, { description: "x2", qty: 12, rate: 200 }],
      taxRate: 0.925, paymentMethods: ["Cash", "Check"], reminderDays: [7, 1],
    });
    expect(invoiceFormSchema.parse({ ...valid, reminderDays: "" }).reminderDays).toEqual([]);
    expect(invoiceFormSchema.parse({ ...valid, taxRate: "" }).taxRate).toBe(0);
  });
  it.each([
    [{ items: [{ description: "x", qty: "1", rate: "0" }] }, "more than zero"],
    [{ items: [{ description: "x", qty: "1", rate: "ten" }] }, "rate like"],
    [{ items: [{ description: "x", qty: "0", rate: "5" }] }, "quantity above zero"],
    [{ items: [{ description: "", qty: "1", rate: "5" }] }, "Describe the service"],
    [{ items: [] }, "at least one"],
    [{ taxRate: "abc" }, "tax rate"],
    [{ fromName: "" }, "business name"],
    [{ dueOn: "2026-09-30" }, "before the issue date"],
    [{ client: "A" }, "client name"],
    [{ reminderDays: "0" }, "1 day or more"],
  ])("rejects %j", (patch, text) => {
    const r = invoiceFormSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain(text);
  });
});

describe("totals and invoice numbers", () => {
  it("matches the reference invoice: $68.87 + 0.925% tax = $69.51", () => {
    const items = [{ description: "file reorg", qty: 1, rateCents: 4_487 }, { description: "x2", qty: 12, rateCents: 200 }];
    expect(invoiceTotals(items, 0.925)).toEqual({ subtotalCents: 6_887, taxCents: 64, totalCents: 6_951 });
    expect(invoiceTotals(items, 0).totalCents).toBe(6_887);
    expect(describeItems(items)).toBe("file reorg +1 more");
  });
  it("numbers new invoices from the issue date and skips numbers in use", () => {
    expect(generateInvoiceNumber("2026-09-14", [], () => 0.5)).toBe("INV-260914-5500");
    expect(generateInvoiceNumber("2026-09-14", ["inv-260914-5500"], (() => { let n = 0; return () => [0.5, 0.1][n++]; })())).toBe("INV-260914-1900");
  });
});

describe("hasNextInvoice", () => {
  const base = inv({ id: "a", recurrence: "monthly", issuedOn: "2026-10-01", dueOn: "2026-10-31" });
  it("detects an already-created next invoice and ignores one-time invoices", () => {
    expect(hasNextInvoice(base, [base])).toBe(false);
    const next = nextRecurringInvoice(base, [base], "b")!;
    expect(hasNextInvoice(base, [base, next])).toBe(true);
    expect(hasNextInvoice(inv(), [inv()])).toBe(false);
  });
});

describe("shared invoice link", () => {
  it("round-trips only the client-facing fields", async () => {
    const { encodeInvoice, decodeInvoice, invoiceHtml } = await import("@/lib/invoices/share");
    const shared = decodeInvoice(encodeInvoice(inv({ client: "Zoë <b>", notes: "Thanks" })))!;
    expect(shared.client).toBe("Zoë <b>");
    expect(shared).not.toHaveProperty("reminderDays");
    const html = invoiceHtml(shared);
    expect(html).toContain("Zoë &lt;b&gt;");
    expect(html).toContain("Subtotal");
    expect(html).toContain("Total");
  });
  it("rejects tampered or malformed tokens", async () => {
    const { decodeInvoice } = await import("@/lib/invoices/share");
    expect(decodeInvoice("not*valid")).toBeNull();
    expect(decodeInvoice("e30")).toBeNull(); // {}
  });
});

describe("void, reopen and payment date", () => {
  it("reopens a void invoice as a draft and an unpaid-again invoice as sent", () => {
    expect(reopen(voidInvoice(inv())).status).toBe("draft");
    const paid = markPaid(inv(), "2026-10-20");
    expect(reopen(paid)).toMatchObject({ status: "sent", paidOn: null });
    expect(reopen(inv({ status: "draft" })).status).toBe("draft");
  });
  it("accepts a past payment date but not one before issue, in the future or invalid", () => {
    const i = inv({ issuedOn: "2026-10-01" });
    expect(paymentDateError(i, "2026-10-10", TODAY)).toBeNull();
    expect(paymentDateError(i, "2026-09-30", TODAY)).toMatch(/before/);
    expect(paymentDateError(i, "2026-10-26", TODAY)).toMatch(/future/);
    expect(paymentDateError(i, "nope", TODAY)).toMatch(/valid/);
  });
});

describe("invoice email", () => {
  it("builds a mailto with the recipient, subject and a link, encoded", async () => {
    const { invoiceMailto } = await import("@/lib/invoices/share");
    const url = invoiceMailto(inv({ clientEmail: "a@b.co", client: "Zoë & Co" }), "https://app.test");
    expect(url.startsWith("mailto:a%40b.co?subject=")).toBe(true);
    const body = decodeURIComponent(url.split("body=")[1]);
    expect(body).toContain("Hi Zoë & Co,");
    expect(body).toContain("https://app.test/invoice/");
  });
  it("accepts an empty or single valid client email only", () => {
    const base = { number: "INV-1", fromName: "Me LLC", fromAddress: "", fromPhone: "", fromEmail: "", client: "Acme", items: [{ description: "x", qty: "1", rate: "10" }], taxRate: "", paymentMethods: "", issuedOn: "2026-10-01", dueOn: "2026-10-31", recurrence: "none", reminderDays: "7", notes: "" };
    const ok = (clientEmail: string) => invoiceFormSchema.safeParse({ ...base, clientEmail }).success;
    expect(ok("")).toBe(true);
    expect(ok("a@b.co")).toBe(true);
    expect(ok("a@b.co, c@d.co")).toBe(false);
    expect(ok("nope")).toBe(false);
  });
});
