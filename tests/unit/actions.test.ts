import { describe, expect, it } from "vitest";
import { abilitiesFor, ACTIONS, ALLOWED, MAX_REMIND_DAYS, runAction, type ActionContext, type ActionState } from "@/lib/actions";
import type { Contact } from "@/lib/contacts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Todo } from "@/lib/todos/logic";

const T = "2026-11-10";
let n = 0;
const state = (over: Partial<ActionState> = {}): ActionState => ({ todos: [], reminders: [], contacts: [], invoices: [], ...over });
const ctx = (over: Partial<ActionState> = {}): ActionContext => ({ state: state(over), today: T, newId: () => `id${++n}` });
const todo = (title: string, over: Partial<Todo> = {}): Todo => ({ id: `t-${title}`, title, done: false, day: T, ...over });
const contact = (over: Partial<Contact> = {}): Contact => ({ id: "c1", name: "Ada Lovelace", email: "ada@example.com", phone: "", company: "", category: "Customer", notes: "", lastContacted: "", createdOn: "2026-01-01", ...over });
const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1", number: "INV-1001", client: "Acme Co", clientEmail: "", description: "Work", items: [], taxRate: 0,
  sender: { name: "", address: "", phone: "", email: "" }, paymentMethods: [], amountCents: 45000, issuedOn: "2026-11-01", dueOn: "2026-11-15",
  status: "sent", paidOn: null, recurrence: "none", reminderDays: [], notes: "", ...over,
});

describe("runAction gates", () => {
  it("refuses an unknown action", () => {
    expect(runAction("nope", {}, ctx(), { caller: "app" })).toMatchObject({ ok: false });
  });

  it("keeps Addy to the three actions on the owner's own lists", () => {
    expect(ALLOWED.addy).toEqual(["todo.add", "todo.complete", "reminder.set"]);
    for (const id of ["contact.create", "invoice.markPaid"]) {
      const r = runAction(id, { name: "Bo Ng", query: "Acme" }, ctx({ invoices: [invoice()] }), { caller: "addy", confirmed: true });
      expect(r.ok, id).toBe(false);
      expect(r.changes, id).toBeUndefined();
    }
  });

  it("lists every action for the app and only the safe three for Addy", () => {
    expect(ALLOWED.app).toEqual(ACTIONS.map((a) => a.id));
    expect(abilitiesFor("addy")).toHaveLength(3);
  });

  it("needs the owner's yes before it changes a record", () => {
    const r = runAction("invoice.markPaid", { query: "Acme" }, ctx({ invoices: [invoice()] }), { caller: "app" });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("needs your yes");
    expect(r.changes).toBeUndefined();
  });

  it("refuses card numbers, Social Security numbers and passwords in any field, for any caller", () => {
    for (const caller of ["app", "addy"] as const) {
      const r = runAction("todo.add", { title: "pay with 4111 1111 1111 1111" }, ctx(), { caller });
      expect(r.ok).toBe(false);
      expect(r.text).toContain("card number");
    }
    expect(runAction("contact.create", { name: "Bo", notes: "ssn 123-45-6789" }, ctx(), { caller: "app" }).ok).toBe(false);
  });
});

describe("to-do and reminder actions", () => {
  it("adds a to-do and hands back the old list as the undo", () => {
    const r = runAction("todo.add", { title: "Call the accountant." }, ctx(), { caller: "addy" });
    expect(r.ok).toBe(true);
    expect(r.changes?.todos).toHaveLength(1);
    expect(r.changes?.todos?.[0]).toMatchObject({ title: "Call the accountant", day: T, done: false });
    expect(r.undo).toEqual({ todos: [] });
    expect(r.audit?.verb).toBe("asked Addy to add");
  });

  it("does not double up, and reports that as a no-op rather than a failure", () => {
    const r = runAction("todo.add", { title: "Call the accountant" }, ctx({ todos: [todo("Call the accountant")] }), { caller: "addy" });
    expect(r.ok).toBe(true);
    expect(r.changes).toBeUndefined();
    expect(r.text).toContain("already on your list");
  });

  it("ticks off a single match, asks when several match, and says when none do", () => {
    const todos = [todo("call the accountant"), todo("call the bank")];
    const one = runAction("todo.complete", { query: "bank" }, ctx({ todos }), { caller: "addy" });
    expect(one.changes?.todos?.find((t) => t.title === "call the bank")?.done).toBe(true);
    expect(one.undo).toEqual({ todos });
    const many = runAction("todo.complete", { query: "call" }, ctx({ todos }), { caller: "addy" });
    expect(many).toMatchObject({ ok: false });
    expect(many.text).toContain("More than one");
    expect(runAction("todo.complete", { query: "dentist" }, ctx({ todos }), { caller: "addy" }).text).toContain("could not find");
  });

  it("sets a reminder with the days clamped to 1..60 and a default of tomorrow", () => {
    const far = runAction("reminder.set", { title: "renew", days: 99 }, ctx(), { caller: "addy" });
    expect(far.changes?.reminders?.[0].on).toBe("2027-01-09"); // 2026-11-10 + 60 days
    expect(MAX_REMIND_DAYS).toBe(60);
    const dflt = runAction("reminder.set", { title: "renew" }, ctx(), { caller: "addy" });
    expect(dflt.changes?.reminders?.[0].on).toBe("2026-11-11");
    expect(dflt.undo).toEqual({ reminders: [] });
  });
});

describe("contact.create", () => {
  it("adds a validated, tidied contact and can be undone", () => {
    const r = runAction("contact.create", { name: "  bo   ng ", email: "BO@Example.com", category: "lead" }, ctx(), { caller: "app" });
    expect(r.ok).toBe(true);
    expect(r.changes?.contacts?.[0]).toMatchObject({ email: "bo@example.com", category: "Lead", createdOn: T });
    expect(r.undo).toEqual({ contacts: [] });
  });

  it("uses the Contacts form's own checks", () => {
    const r = runAction("contact.create", { name: "Bo", email: "nope" }, ctx(), { caller: "app" });
    expect(r).toMatchObject({ ok: false });
    expect(r.text).toContain("not a valid email");
    expect(runAction("contact.create", { email: "a@b.co" }, ctx(), { caller: "app" }).text).toContain("Name is required");
  });

  it("refuses a likely duplicate and points to the existing contact", () => {
    const r = runAction("contact.create", { name: "Someone Else", email: "ada@example.com" }, ctx({ contacts: [contact()] }), { caller: "app" });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("Ada Lovelace is already in Contacts");
    expect(r.changes).toBeUndefined();
  });
});

describe("invoice.markPaid", () => {
  const go = (input: unknown, invoices: Invoice[], confirmed = true) => runAction("invoice.markPaid", input, ctx({ invoices }), { caller: "app", confirmed });

  it("marks one outstanding invoice paid today and can be undone", () => {
    const list = [invoice(), invoice({ id: "i2", number: "INV-1002", client: "Other" })];
    const r = go({ query: "acme" }, list);
    expect(r.ok).toBe(true);
    expect(r.changes?.invoices?.find((i) => i.id === "i1")).toMatchObject({ status: "paid", paidOn: T });
    expect(r.changes?.invoices?.find((i) => i.id === "i2")?.status).toBe("sent");
    expect(r.undo).toEqual({ invoices: list });
  });

  it("finds by invoice number and accepts an earlier payment date", () => {
    const r = go({ query: "INV-1001", paidOn: "2026-11-05" }, [invoice()]);
    expect(r.changes?.invoices?.[0].paidOn).toBe("2026-11-05");
  });

  it("refuses a future date, a date before it was issued, and a bad date", () => {
    expect(go({ query: "acme", paidOn: "2026-12-01" }, [invoice()]).text).toContain("future");
    expect(go({ query: "acme", paidOn: "2026-10-01" }, [invoice()]).text).toContain("before the invoice was issued");
    expect(go({ query: "acme", paidOn: "soon" }, [invoice()]).text).toContain("YYYY-MM-DD");
  });

  it("only touches outstanding invoices, and asks for the number when several match", () => {
    expect(go({ query: "acme" }, [invoice({ status: "paid", paidOn: T })]).text).toContain("could not find");
    expect(go({ query: "acme" }, [invoice({ status: "draft" })]).ok).toBe(false);
    const two = go({ query: "acme" }, [invoice(), invoice({ id: "i2", number: "INV-1002" })]);
    expect(two.ok).toBe(false);
    expect(two.text).toContain("Give the invoice number");
  });
});
