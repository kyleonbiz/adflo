import { addDays, formatDayLong } from "@/lib/dates";
import { reminderId, setReminder, type Reminder } from "@/lib/reminders/logic";
import { addTodo, hasOpenTodo, MAX_TITLE, pruneTodos, toggleTodo, todaysTodos, type Todo } from "@/lib/todos/logic";
import { looksSensitive } from "./guardrails";

/**
 * The few things Addy does by itself instead of opening a form. Each one only touches the owner's own to-do
 * list or reminders, can be undone with one tap, and never saves, deletes, approves, pays, sends or signs
 * anything in a service.
 */
export type DirectAction =
  | { kind: "todo"; title: string }
  | { kind: "remind"; title: string; days: number }
  | { kind: "done"; query: string };

export const MAX_REMIND_DAYS = 60;

const clean = (s: string): string => s.replace(/^["'“”‘’\s]+|["'“”‘’\s.!?]+$/g, "").replace(/\s+/g, " ").trim();

/** Reads a plain request such as "add call the accountant to my to-do list" or "remind me to renew the permit in 3 days". */
export function parseDirect(input: string): DirectAction | null {
  const text = input.trim().replace(/^please\s+/i, "");
  let m: RegExpMatchArray | null;

  if ((m = text.match(/^remind me\s+(?:to|about|of)\s+(.+?)(?:\s+(tomorrow|next week|in a week|in (\d{1,2}) days?))?\s*[.!]*$/i))) {
    const title = clean(m[1]);
    const when = (m[2] ?? "").toLowerCase();
    const days = when === "next week" || when === "in a week" ? 7 : m[3] ? Number(m[3]) : 1;
    return title ? { kind: "remind", title, days: Math.min(Math.max(days, 1), MAX_REMIND_DAYS) } : null;
  }
  if ((m = text.match(/^(?:add|put)\s+(.+?)\s+(?:to|on|onto)\s+(?:my|the|today'?s)?\s*(?:to-?do(?:s)?(?:\s+list)?|task\s+list|list|today)\s*[.!]*$/i))) {
    const title = clean(m[1]);
    return title ? { kind: "todo", title } : null;
  }
  if ((m = text.match(/^(?:add|create)\s+(?:a\s+)?(?:to-?do|task)\s*(?:to|:|-)?\s*(.+)$/i))) {
    const title = clean(m[1]);
    return title ? { kind: "todo", title } : null;
  }
  if ((m = text.match(/^(?:mark|tick(?:\s+off)?|check\s+off|complete|finish)\s+(.+?)\s+(?:as\s+)?(?:done|complete(?:d)?)\s*[.!]*$/i))) {
    const query = clean(m[1]);
    return query ? { kind: "done", query } : null;
  }
  return null;
}

export interface DirectContext { todos: Todo[]; reminders: Reminder[]; today: string; newId: () => string }

/** What happened: the sentence to show, the new saved lists (when something changed), and how to put it back. */
export interface DirectResult {
  text: string;
  link?: { label: string; href: string };
  todos?: Todo[];
  reminders?: Reminder[];
  undo?: { todos?: Todo[]; reminders?: Reminder[] };
}

/** Carries out one direct action against the saved lists. Pure: the caller saves what comes back. */
export function runDirect(action: DirectAction, ctx: DirectContext): DirectResult {
  const { todos, reminders, today } = ctx;

  if (action.kind === "todo" || action.kind === "remind") {
    if (action.title.length < 2) return { text: "What should it say? Tell me a few words about the task." };
    if (action.title.length > MAX_TITLE) return { text: `That is too long for a to-do. Keep it under ${MAX_TITLE} characters.` };
    if (looksSensitive(action.title)) return { text: "That looks like a card number, Social Security number or password, so I will not write it down. Leave those out and try again." };
  }

  if (action.kind === "todo") {
    if (hasOpenTodo(todos, action.title, today)) return { text: `"${action.title}" is already on your list for today.`, link: { label: "Open today", href: "/app/overview" } };
    const next = pruneTodos(addTodo(todos, action.title, today, ctx.newId()), today);
    return {
      text: `Added "${action.title}" to your to-do list for today.`,
      link: { label: "Open today", href: "/app/overview" },
      todos: next, undo: { todos },
    };
  }

  if (action.kind === "remind") {
    const on = addDays(today, action.days);
    const next = setReminder(reminders, { id: reminderId("task", `addy-${ctx.newId()}`), text: action.title, area: "Tasks", href: "/app/calendar" }, today, action.days);
    return {
      text: `I will remind you on ${formatDayLong(on)}: ${action.title}. It will show in the bell, on the Dashboard and on the calendar.`,
      link: { label: "Open calendar", href: "/app/calendar" },
      reminders: next, undo: { reminders },
    };
  }

  const q = action.query.toLowerCase();
  const open = todaysTodos(todos, today).filter((t) => !t.done && t.title.toLowerCase().includes(q));
  if (open.length === 0) return { text: `I could not find an open to-do for today that matches "${action.query}".`, link: { label: "Open today", href: "/app/overview" } };
  if (open.length > 1) return { text: `More than one to-do matches "${action.query}": ${open.slice(0, 4).map((t) => `"${t.title}"`).join(", ")}. Say a little more of the one you mean.` };
  return { text: `Ticked off "${open[0].title}".`, link: { label: "Open today", href: "/app/overview" }, todos: toggleTodo(todos, open[0].id), undo: { todos } };
}

/** Plain-language list of what Addy may do by itself, for the model's instructions and the help text. */
export const DIRECT_ABILITIES = [
  "add something to the owner's to-do list for today",
  "set a reminder for the owner (from tomorrow up to 60 days away)",
  "tick off one of the owner's to-dos for today",
] as const;


