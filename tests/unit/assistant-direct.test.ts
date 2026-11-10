import { describe, expect, it } from "vitest";
import { MAX_REMIND_DAYS, parseDirect, runDirect, type DirectContext } from "@/lib/assistant/direct";
import { emptySources } from "@/lib/reporting/logic";
import type { Invoice } from "@/lib/invoices/types";
import type { Todo } from "@/lib/todos/logic";

const T = "2026-11-05";
let n = 0;
const ctx = (over: Partial<DirectContext> = {}): DirectContext => ({ todos: [], reminders: [], today: T, newId: () => `id${++n}`, ...over });
const todo = (title: string, over: Partial<Todo> = {}): Todo => ({ id: `t-${title}`, title, done: false, day: T, ...over });

describe("parseDirect", () => {
  it("reads adding to the to-do list in the ways people say it", () => {
    expect(parseDirect("Add call the accountant to my to-do list")).toEqual({ kind: "todo", title: "call the accountant" });
    expect(parseDirect("please add \"Send the W-9\" to today's list.")).toEqual({ kind: "todo", title: "Send the W-9" });
    expect(parseDirect("put order toner on my todo list")).toEqual({ kind: "todo", title: "order toner" });
    expect(parseDirect("add a task: renew the food permit")).toEqual({ kind: "todo", title: "renew the food permit" });
  });

  it("reads reminders, with tomorrow as the default and a cap on how far ahead", () => {
    expect(parseDirect("Remind me to renew the permit")).toEqual({ kind: "remind", title: "renew the permit", days: 1 });
    expect(parseDirect("remind me about the audit tomorrow")).toEqual({ kind: "remind", title: "the audit", days: 1 });
    expect(parseDirect("remind me to call Acme in 3 days")).toEqual({ kind: "remind", title: "call Acme", days: 3 });
    expect(parseDirect("remind me to file taxes next week")).toEqual({ kind: "remind", title: "file taxes", days: 7 });
    expect(parseDirect("remind me to renew in 99 days")).toEqual({ kind: "remind", title: "renew", days: MAX_REMIND_DAYS });
  });

  it("reads ticking something off", () => {
    expect(parseDirect("mark call the accountant as done")).toEqual({ kind: "done", query: "call the accountant" });
    expect(parseDirect("Tick off order toner done")).toEqual({ kind: "done", query: "order toner" });
  });

  it("leaves everything else to the rest of the assistant", () => {
    for (const s of ["new invoice", "delete the Acme invoice", "approve the vendor", "send the invoice to Acme", "what is left", "mark the invoice paid", "add a contact", "remind me"]) {
      expect(parseDirect(s), s).toBeNull();
    }
  });
});

describe("runDirect", () => {
  it("adds a to-do for today and can put the list back", () => {
    const r = runDirect({ kind: "todo", title: "Call the accountant" }, ctx());
    expect(r.todos).toHaveLength(1);
    expect(r.todos![0]).toMatchObject({ title: "Call the accountant", done: false, day: T });
    expect(r.undo).toEqual({ todos: [] });
    expect(r.text).toContain("Added");
  });

  it("does not add the same open to-do twice", () => {
    const r = runDirect({ kind: "todo", title: "Call the accountant" }, ctx({ todos: [todo("Call the accountant")] }));
    expect(r.todos).toBeUndefined();
    expect(r.text).toContain("already on your list");
  });

  it("sets a reminder for the day asked, and can clear it", () => {
    const r = runDirect({ kind: "remind", title: "Renew the permit", days: 3 }, ctx());
    expect(r.reminders).toHaveLength(1);
    expect(r.reminders![0]).toMatchObject({ text: "Renew the permit", on: "2026-11-08", area: "Tasks" });
    expect(r.reminders![0].id.startsWith("rem-")).toBe(true);
    expect(r.undo).toEqual({ reminders: [] });
    expect(r.text).toContain("Nov 8, 2026");
  });

  it("ticks off the one open to-do that matches, and only that one", () => {
    const todos = [todo("Call the accountant"), todo("Order toner"), todo("Call the bank")];
    const r = runDirect({ kind: "done", query: "accountant" }, ctx({ todos }));
    expect(r.todos!.find((t) => t.title === "Call the accountant")!.done).toBe(true);
    expect(r.todos!.filter((t) => t.done)).toHaveLength(1);
    expect(r.undo).toEqual({ todos });
  });

  it("asks which one when several match, and says so when none do", () => {
    const todos = [todo("Call the accountant"), todo("Call the bank")];
    const many = runDirect({ kind: "done", query: "call" }, ctx({ todos }));
    expect(many.todos).toBeUndefined();
    expect(many.text).toContain("More than one");
    const none = runDirect({ kind: "done", query: "dentist" }, ctx({ todos }));
    expect(none.todos).toBeUndefined();
    expect(none.text).toContain("could not find");
  });

  it("refuses card numbers, passwords and over-long text, and writes nothing", () => {
    const card = runDirect({ kind: "todo", title: "Pay with 4111 1111 1111 1111" }, ctx());
    expect(card.todos).toBeUndefined();
    expect(card.text).toContain("card number");
    const long = runDirect({ kind: "remind", title: "x".repeat(200), days: 1 }, ctx());
    expect(long.reminders).toBeUndefined();
    expect(long.text).toContain("too long");
  });
});

describe("reports", () => {
  it("reads report requests", () => {
    expect(parseDirect("run a report on invoices")).toEqual({ kind: "report", topic: "invoices", mode: "summary" });
    expect(parseDirect("Show me the vendor report")).toEqual({ kind: "report", topic: "vendor", mode: "summary" });
    expect(parseDirect("run reports")).toEqual({ kind: "report", topic: "", mode: "summary" });
    expect(parseDirect("how are we doing?")).toEqual({ kind: "report", topic: "", mode: "explain" });
    expect(parseDirect("explain the invoice report")).toEqual({ kind: "report", topic: "invoice", mode: "explain" });
    expect(parseDirect("explain my numbers")).toEqual({ kind: "report", topic: "", mode: "explain" });
    expect(parseDirect("export invoices to Excel")).toEqual({ kind: "report", topic: "invoices", mode: "export" });
    expect(parseDirect("download the vendor report as csv")).toEqual({ kind: "report", topic: "vendor", mode: "export" });
    expect(parseDirect("explain how to set up")).toBeNull();
    expect(parseDirect("download the app")).toBeNull();
    expect(parseDirect("send the report to Acme")).toBeNull();
  });

  it("summarizes without changing anything", () => {
    const inv = { id: "i1", client: "Acme", description: "Work", amount: 500, dueOn: "2026-10-01", status: "sent", issuedOn: "2026-09-01", recurrence: "none" } as unknown as Invoice;
    const sources = { ...emptySources(), invoices: [inv] };
    const r = runDirect({ kind: "report", topic: "invoices", mode: "summary" }, ctx({ sources }));
    expect(r.text).toContain("Invoices (1 invoice)");
    expect(r.link?.href).toBe("/app/reporting?view=invoices");
    expect(r.todos).toBeUndefined();
    expect(r.reminders).toBeUndefined();
    expect(r.undo).toBeUndefined();
  });

  it("explains empty, unknown and unreadable cases", () => {
    expect(runDirect({ kind: "report", topic: "", mode: "summary" }, ctx({ sources: emptySources() })).text).toContain("nothing to report");
    expect(runDirect({ kind: "report", topic: "weather", mode: "summary" }, ctx({ sources: emptySources() })).text).toContain("Which one");
    expect(runDirect({ kind: "report", topic: "", mode: "summary" }, ctx()).text).toContain("cannot read");
  });

  it("explains a report in plain words, urgent items first", () => {
    const late = { id: "i1", number: "INV-1", client: "Acme", description: "Work", amountCents: 50000, dueOn: "2026-10-01", issuedOn: "2026-09-01", status: "sent", recurrence: "none" } as unknown as Invoice;
    const sources = { ...emptySources(), invoices: [late] };
    const r = runDirect({ kind: "report", topic: "invoices", mode: "explain" }, ctx({ sources }));
    expect(r.text).toContain("Invoices: 1 invoice tracked.");
    expect(r.text).toMatch(/Urgent: overdue is 1/);
    expect(r.text).toContain("Acme leads");
    expect(r.download).toBeUndefined();
  });

  it("offers the table as a download and changes nothing", () => {
    const inv = { id: "i1", number: "INV-1", client: "Acme", description: "Work", amountCents: 50000, dueOn: "2026-12-01", issuedOn: "2026-11-01", status: "sent", recurrence: "none" } as unknown as Invoice;
    const r = runDirect({ kind: "report", topic: "invoices", mode: "export" }, ctx({ sources: { ...emptySources(), invoices: [inv] } }));
    expect(r.download?.name).toBe(`invoices-${T}`);
    expect(r.download?.headers[0]).toBe("Number");
    expect(r.download?.rows).toHaveLength(1);
    expect(r.todos).toBeUndefined();
    expect(runDirect({ kind: "report", topic: "", mode: "export" }, ctx({ sources: emptySources() })).text).toContain("Which report");
  });
});
