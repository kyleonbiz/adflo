import { describe, expect, it } from "vitest";
import { MAX_CREATED_PER_WORKSPACE, createNextInvoice, dueReminder, newInvoiceEmail, recurringDue, reminderEmail, reminderSchedule, withReminderSent, withoutReminderSent } from "@/lib/invoices/auto";
import { nextRecurringInvoice } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";

const inv = (o: Partial<Invoice> = {}): Invoice => ({
  id: "i1", number: "INV-0041", client: "Northwind Properties", clientEmail: "ap@northwind.test", description: "Roof repair", items: [{ description: "Roof repair", qty: 1, rateCents: 482000 }],
  taxRate: 0, sender: { name: "Acme Roofing", address: "", phone: "", email: "office@acme.test" }, paymentMethods: ["Check", "Bank transfer"], amountCents: 482000,
  issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "sent", paidOn: null, recurrence: "none", reminderDays: [7, 1], notes: "", ...o,
});
const ORIGIN = "https://www.adflo.pro";

describe("reminderSchedule", () => {
  it("lists the reminder days, the due date and three weekly overdue notices, in order", () => {
    expect(reminderSchedule(inv()).map((p) => [p.on, p.kind])).toEqual([
      ["2026-11-08", "upcoming"], ["2026-11-14", "upcoming"], ["2026-11-15", "due"], ["2026-11-22", "overdue"], ["2026-11-29", "overdue"], ["2026-12-06", "overdue"],
    ]);
  });
  it("leaves out dates before the invoice was issued, and nonsense reminder days", () => {
    const s = reminderSchedule(inv({ issuedOn: "2026-11-12", reminderDays: [7, 1, 0, -2, 1.5] }));
    expect(s.map((p) => p.on)).toEqual(["2026-11-14", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06"]);
  });
});

describe("dueReminder", () => {
  it.each([
    ["2026-11-07", null], ["2026-11-08", "upcoming"], ["2026-11-14", "upcoming"], ["2026-11-15", "due"], ["2026-11-18", null],
    ["2026-11-22", "overdue"], ["2026-11-29", "overdue"], ["2026-12-06", "overdue"], ["2026-12-13", null],
  ])("on %s: %s", (today, kind) => expect(dueReminder(inv(), today)?.kind ?? null).toBe(kind));

  it("sends each reminder once", () => {
    const point = dueReminder(inv(), "2026-11-15")!;
    expect(dueReminder(withReminderSent(inv(), point), "2026-11-15")).toBeNull();
    expect(dueReminder(withReminderSent(inv(), point), "2026-11-16")).toBeNull(); // still inside the grace period, but already sent
  });

  it("is only for a sent invoice with a usable client email", () => {
    for (const status of ["draft", "paid", "void"] as const) expect(dueReminder(inv({ status }), "2026-11-15")).toBeNull();
    for (const clientEmail of ["", "no at sign", "a@b"]) expect(dueReminder(inv({ clientEmail }), "2026-11-15")).toBeNull();
  });

  it("sends a missed reminder a day or two late, but never later", () => {
    expect(dueReminder(inv(), "2026-11-17")?.on).toBe("2026-11-15"); // due-date email, two days late
    expect(dueReminder(inv(), "2026-11-18")).toBeNull();
  });

  it("only ever moves forward: an older reminder is not sent after a newer one", () => {
    const sentDue = withReminderSent(inv(), { on: "2026-11-15", kind: "due" });
    expect(dueReminder(sentDue, "2026-11-16")).toBeNull(); // the 14th (upcoming) is now behind us
    // and when the job missed a day, one email goes out for the latest point, not two
    expect(dueReminder(inv(), "2026-11-15")?.kind).toBe("due");
  });

  it("can take a recorded reminder back, so a failed send is tried again", () => {
    const point = dueReminder(inv(), "2026-11-15")!;
    const recorded = withReminderSent(inv(), point);
    expect(withoutReminderSent(recorded, point).remindersSent).toEqual([]);
    expect(dueReminder(withoutReminderSent(recorded, point), "2026-11-15")?.on).toBe("2026-11-15");
  });
});

describe("reminderEmail", () => {
  const day = (today: string) => reminderEmail(inv(), dueReminder(inv(), today)!, today, { origin: ORIGIN, business: "Acme Roofing" });

  it("says how close the due date is, with the amount, ways to pay and a link", () => {
    const m = day("2026-11-08");
    expect(m.subject).toBe("Invoice INV-0041 is due Nov 15, 2026");
    expect(m.text).toContain("$4,820");
    expect(m.text).toContain("in 7 days");
    expect(m.text).toContain("You can pay by: Check, Bank transfer.");
    expect(m.text).toContain(`${ORIGIN}/invoice/`);
    expect(m.text).toContain("If you have already paid, thank you");
    expect(m.html).toContain("View invoice");
  });

  it("is firmer as the payment gets later", () => {
    expect(day("2026-11-15").subject).toBe("Reminder: invoice INV-0041 is due today");
    expect(day("2026-11-22").subject).toBe("Overdue: invoice INV-0041 ($4,820.00)");
    expect(day("2026-11-29").text).toContain("14 days past its");
    expect(day("2026-11-29").subject.startsWith("Past due:")).toBe(true);
  });

  it("cannot add mail headers or markup through a name", () => {
    const evil = inv({ client: "Sam\r\nBcc: spy@x.test", sender: { name: "Acme\nBcc: z@z.test", address: "", phone: "", email: "" }, paymentMethods: ["<script>x</script>"] });
    const m = reminderEmail(evil, { on: "2026-11-15", kind: "due" }, "2026-11-15", { origin: ORIGIN, business: "Acme" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text.split("\n").some((l) => /^Bcc:/.test(l))).toBe(false);
    expect(m.html).not.toContain("<script>");
  });

  it("leaves the link out when the invoice is too long to fit in one", () => {
    const huge = inv({ items: Array.from({ length: 50 }, (_, i) => ({ description: `Line ${i} ${"x".repeat(190)}`, qty: 1, rateCents: 100 })) });
    const m = reminderEmail(huge, { on: "2026-11-15", kind: "due" }, "2026-11-15", { origin: ORIGIN, business: "Acme" });
    expect(m.text).not.toContain("View the invoice:");
  });
});

describe("recurring invoices", () => {
  const monthly = (o: Partial<Invoice> = {}) => inv({ recurrence: "monthly", issuedOn: "2026-10-15", dueOn: "2026-10-29", ...o });

  it("is due on the next issue date, and a few days after if the job was missed", () => {
    expect(recurringDue([monthly()], "2026-11-14")).toHaveLength(0);
    expect(recurringDue([monthly()], "2026-11-15")).toHaveLength(1);
    expect(recurringDue([monthly()], "2026-11-18")).toHaveLength(1);
    expect(recurringDue([monthly()], "2026-11-19")).toHaveLength(0); // an abandoned series is not brought back to life
  });

  it("is only for a series whose last invoice was sent or paid, and never twice", () => {
    expect(recurringDue([monthly({ status: "draft" })], "2026-11-15")).toHaveLength(0);
    expect(recurringDue([monthly({ status: "void" })], "2026-11-15")).toHaveLength(0);
    expect(recurringDue([monthly({ status: "paid", paidOn: "2026-10-20" })], "2026-11-15")).toHaveLength(1);
    const first = monthly();
    const next = createNextInvoice(first, [first], "n1", "draft", "2026-11-15")!;
    expect(recurringDue([first, next], "2026-11-15")).toHaveLength(0); // it exists now
    expect(recurringDue([inv({ recurrence: "none" })], "2026-11-15")).toHaveLength(0);
  });

  it("caps how many one workspace creates in a run", () => {
    const many = Array.from({ length: MAX_CREATED_PER_WORKSPACE + 5 }, (_, i) => monthly({ id: `i${i}`, number: `INV-${100 + i}`, client: `Client ${i}` }));
    expect(recurringDue(many, "2026-11-15")).toHaveLength(MAX_CREATED_PER_WORKSPACE);
  });

  it("creates the next one as a draft to approve, or sent when asked and there is an email", () => {
    const first = monthly();
    const draft = createNextInvoice(first, [first], "n1", "draft", "2026-11-15")!;
    expect(draft).toMatchObject({ id: "n1", number: "INV-0042", issuedOn: "2026-11-15", dueOn: "2026-11-29", status: "draft", paidOn: null, autoCreatedOn: "2026-11-15" });
    expect(createNextInvoice(first, [first], "n2", "send", "2026-11-15")!.status).toBe("sent");
    expect(createNextInvoice(monthly({ clientEmail: "" }), [first], "n3", "send", "2026-11-15")!.status).toBe("draft"); // nowhere to send it
    expect(createNextInvoice(inv(), [], "n4", "draft", "2026-11-15")).toBeNull();
  });

  it("starts the next invoice clean: no reminders, no copy-in-Documents mark, not marked as automatic", () => {
    const next = nextRecurringInvoice(monthly({ remindersSent: ["2026-10-29"], savedToDocumentsOn: "2026-10-16", autoCreatedOn: "2026-10-15" }), [], "n1")!;
    expect(next.remindersSent).toBeUndefined();
    expect(next.savedToDocumentsOn).toBeUndefined();
    expect(next.autoCreatedOn).toBeUndefined();
  });

  it("emails a newly sent invoice with its amount, due date and link", () => {
    const m = newInvoiceEmail(inv(), { origin: ORIGIN, business: "Acme Roofing" });
    expect(m.subject).toBe("Invoice INV-0041 from Acme Roofing");
    expect(m.text).toContain("$4,820.00, due Nov 15, 2026");
    expect(m.text).toContain(`${ORIGIN}/invoice/`);
  });
});
