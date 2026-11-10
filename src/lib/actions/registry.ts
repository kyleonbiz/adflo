import { addDays, formatDayLong, isDay } from "@/lib/dates";
import { findMatches, validateContact } from "@/lib/contacts/logic";
import { markPaid, paymentDateError } from "@/lib/invoices/logic";
import { reminderId, setReminder } from "@/lib/reminders/logic";
import { addTodo, hasOpenTodo, MAX_TITLE, pruneTodos, toggleTodo, todaysTodos } from "@/lib/todos/logic";
import type { ActionDef, Parsed } from "./types";

export const MAX_REMIND_DAYS = 60;

const TODAY_LINK = { label: "Open today", href: "/app/overview" } as const;

const obj = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

/** A string field with surrounding quotes, punctuation and extra spaces tidied away. */
const str = (v: unknown): string =>
  typeof v === "string" ? v.replace(/^["'“”‘’\s]+|["'“”‘’\s.!?]+$/g, "").replace(/\s+/g, " ").trim() : "";

const fail = <I>(error: string): Parsed<I> => ({ ok: false, error });

// --- To-dos and reminders: the owner's own lists ----------------------------------------------------

export const todoAdd: ActionDef<{ title: string }> = {
  id: "todo.add",
  summary: "Add something to the owner's to-do list for today",
  area: "Tasks",
  risk: "safe",
  parse(input) {
    const title = str(obj(input).title);
    if (title.length < 2) return fail("What should it say? Tell me a few words about the task.");
    if (title.length > MAX_TITLE) return fail(`That is too long for a to-do. Keep it under ${MAX_TITLE} characters.`);
    return { ok: true, value: { title } };
  },
  run({ title }, { state, today, newId }) {
    if (hasOpenTodo(state.todos, title, today)) return { ok: true, text: `"${title}" is already on your list for today.`, link: TODAY_LINK };
    const next = pruneTodos(addTodo(state.todos, title, today, newId()), today);
    return {
      ok: true,
      text: `Added "${title}" to your to-do list for today.`,
      link: TODAY_LINK,
      changes: { todos: next },
      undo: { todos: state.todos },
      audit: { verb: "asked Addy to add", detail: `"${title}" to today's to-do list`, area: "Tasks", href: "/app/overview" },
    };
  },
};

export const todoComplete: ActionDef<{ query: string }> = {
  id: "todo.complete",
  summary: "Tick off one of the owner's to-dos for today",
  area: "Tasks",
  risk: "safe",
  parse(input) {
    const query = str(obj(input).query);
    return query ? { ok: true, value: { query } } : fail("Which to-do should I tick off?");
  },
  run({ query }, { state, today }) {
    const q = query.toLowerCase();
    const open = todaysTodos(state.todos, today).filter((t) => !t.done && t.title.toLowerCase().includes(q));
    if (open.length === 0) return { ok: false, text: `I could not find an open to-do for today that matches "${query}".`, link: TODAY_LINK };
    if (open.length > 1) {
      return { ok: false, text: `More than one to-do matches "${query}": ${open.slice(0, 4).map((t) => `"${t.title}"`).join(", ")}. Say a little more of the one you mean.` };
    }
    return {
      ok: true,
      text: `Ticked off "${open[0].title}".`,
      link: TODAY_LINK,
      changes: { todos: toggleTodo(state.todos, open[0].id) },
      undo: { todos: state.todos },
      audit: { verb: "asked Addy to tick off", detail: query, area: "Tasks", href: "/app/overview" },
    };
  },
};

export const reminderSet: ActionDef<{ title: string; days: number }> = {
  id: "reminder.set",
  summary: `Set a reminder for the owner, from tomorrow up to ${MAX_REMIND_DAYS} days away`,
  area: "Tasks",
  risk: "safe",
  parse(input) {
    const o = obj(input);
    const title = str(o.title);
    if (title.length < 2) return fail("What should it say? Tell me a few words about the task.");
    if (title.length > MAX_TITLE) return fail(`That is too long for a to-do. Keep it under ${MAX_TITLE} characters.`);
    const days = typeof o.days === "number" && Number.isFinite(o.days) ? Math.round(o.days) : 1;
    return { ok: true, value: { title, days: Math.min(Math.max(days, 1), MAX_REMIND_DAYS) } };
  },
  run({ title, days }, { state, today, newId }) {
    const on = addDays(today, days);
    const next = setReminder(state.reminders, { id: reminderId("task", `addy-${newId()}`), text: title, area: "Tasks", href: "/app/calendar" }, today, days);
    return {
      ok: true,
      text: `I will remind you on ${formatDayLong(on)}: ${title}. It will show in the bell, on the Dashboard and on the calendar.`,
      link: { label: "Open calendar", href: "/app/calendar" },
      changes: { reminders: next },
      undo: { reminders: state.reminders },
      audit: { verb: "asked Addy to set a reminder:", detail: title, area: "Tasks", href: "/app/calendar" },
    };
  },
};

// --- Service records --------------------------------------------------------------------------------

/** Adds one contact, using the same checks as the Contacts form and refusing a likely duplicate. */
export const contactCreate: ActionDef<Record<string, string>> = {
  id: "contact.create",
  summary: "Add a contact (name, and optionally email, phone, company and category)",
  area: "Contacts",
  risk: "safe",
  parse(input) {
    const o = obj(input);
    const raw: Record<string, string> = {};
    for (const k of ["name", "email", "phone", "company", "category", "notes", "lastContacted"]) {
      const v = o[k];
      if (v === undefined || v === null || v === "") continue;
      if (typeof v !== "string") return fail(`${k} must be text.`);
      raw[k] = v;
    }
    const checked = validateContact(raw);
    if (checked.errors) return fail(Object.values(checked.errors).join(". "));
    return { ok: true, value: raw };
  },
  run(raw, { state, today, newId }) {
    const checked = validateContact(raw);
    if (checked.errors) return { ok: false, text: Object.values(checked.errors).join(". ") };
    const dupes = findMatches(state.contacts, checked.value);
    if (dupes.length > 0) {
      const d = dupes[0];
      return { ok: false, text: `${d.contact.name} is already in Contacts (${d.reasons.join(", ")}). Open it to update it instead.`, link: { label: "Open contacts", href: "/app/contacts" } };
    }
    const contact = { ...checked.value, id: `contact-${newId()}`, createdOn: today };
    return {
      ok: true,
      text: `Added ${contact.name} to Contacts.`,
      link: { label: "Open contacts", href: "/app/contacts" },
      changes: { contacts: [...state.contacts, contact] },
      undo: { contacts: state.contacts },
      audit: { verb: "added contact", detail: contact.name, area: "Contacts", href: "/app/contacts" },
    };
  },
};

/** Marks one outstanding invoice paid. Changes a record's state, so the caller must have the owner's yes. */
export const invoiceMarkPaid: ActionDef<{ query: string; paidOn?: string }> = {
  id: "invoice.markPaid",
  summary: "Mark an outstanding invoice paid, found by its number or client",
  area: "Invoices",
  risk: "confirm",
  parse(input) {
    const o = obj(input);
    const query = str(o.query);
    if (!query) return fail("Which invoice? Give its number or the client's name.");
    const paidOn = typeof o.paidOn === "string" && o.paidOn.trim() ? o.paidOn.trim() : undefined;
    if (paidOn !== undefined && !isDay(paidOn)) return fail("The payment date must be a real date written YYYY-MM-DD.");
    return { ok: true, value: { query, paidOn } };
  },
  run({ query, paidOn }, { state, today }) {
    const q = query.toLowerCase();
    const open = state.invoices.filter((i) => i.status === "sent" && (i.number.toLowerCase() === q || i.client.toLowerCase().includes(q)));
    const link = { label: "Open invoices", href: "/app/invoices" };
    if (open.length === 0) return { ok: false, text: `I could not find an outstanding invoice that matches "${query}".`, link };
    if (open.length > 1) return { ok: false, text: `More than one outstanding invoice matches "${query}": ${open.slice(0, 4).map((i) => `${i.number} (${i.client})`).join(", ")}. Give the invoice number.`, link };
    const inv = open[0];
    const day = paidOn ?? today;
    const problem = paymentDateError(inv, day, today);
    if (problem) return { ok: false, text: `${problem}.`, link };
    return {
      ok: true,
      text: `Marked invoice ${inv.number} (${inv.client}) paid on ${formatDayLong(day)}.`,
      link,
      changes: { invoices: state.invoices.map((i) => (i.id === inv.id ? markPaid(i, day) : i)) },
      undo: { invoices: state.invoices },
      audit: { verb: "marked paid", detail: `invoice ${inv.number} (${inv.client})`, area: "Invoices", href: "/app/invoices" },
    };
  },
};

const erase = <I,>(a: ActionDef<I>): ActionDef => ({ ...a, run: (input, ctx) => a.run(input as I, ctx) });

/** Every action. Add a new one here and it is available to every caller whose policy allows it. */
export const ACTIONS: readonly ActionDef[] = [todoAdd, todoComplete, reminderSet, contactCreate, invoiceMarkPaid].map(erase);

/** What each caller may run. Addy's list is deliberately the three on the owner's own lists. */
export const ALLOWED: Record<"app" | "addy", readonly string[]> = {
  app: ACTIONS.map((a) => a.id),
  addy: ["todo.add", "todo.complete", "reminder.set"],
};
