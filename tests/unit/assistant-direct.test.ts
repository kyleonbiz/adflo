import { describe, expect, it } from "vitest";
import { MAX_REMIND_DAYS, parseDirect, runDirect, type DirectContext } from "@/lib/assistant/direct";
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
