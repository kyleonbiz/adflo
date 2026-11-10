import { abilitiesFor, MAX_REMIND_DAYS as MAX_DAYS, runAction } from "@/lib/actions";
import type { Reminder } from "@/lib/reminders/logic";
import type { Todo } from "@/lib/todos/logic";

/**
 * The few things Addy does by itself instead of opening a form. This file only reads the plain request;
 * the doing is in the action layer (`@/lib/actions`), whose Addy policy allows just these three. Each one only
 * touches the owner's own to-do list or reminders, can be undone with one tap, and never saves, deletes,
 * approves, pays, sends or signs anything in a service.
 */
export type DirectAction =
  | { kind: "todo"; title: string }
  | { kind: "remind"; title: string; days: number }
  | { kind: "done"; query: string };

export const MAX_REMIND_DAYS = MAX_DAYS;

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

const ACTION_ID = { todo: "todo.add", remind: "reminder.set", done: "todo.complete" } as const;

const inputOf = (a: DirectAction) => (a.kind === "todo" ? { title: a.title } : a.kind === "remind" ? { title: a.title, days: a.days } : { query: a.query });

/** Carries out one direct action through the action layer. Pure: the caller saves what comes back. */
export function runDirect(action: DirectAction, ctx: DirectContext): DirectResult {
  const out = runAction(
    ACTION_ID[action.kind],
    inputOf(action),
    { state: { todos: ctx.todos, reminders: ctx.reminders, contacts: [], invoices: [] }, today: ctx.today, newId: ctx.newId },
    { caller: "addy" },
  );
  const { todos, reminders } = out.changes ?? {};
  const back = out.undo ?? {};
  return {
    text: out.text,
    link: out.link,
    ...(todos ? { todos } : {}),
    ...(reminders ? { reminders } : {}),
    ...(out.changes ? { undo: { ...(back.todos ? { todos: back.todos } : {}), ...(back.reminders ? { reminders: back.reminders } : {}) } } : {}),
  };
}

/** Plain-language list of what Addy may do by itself, for the model's instructions and the help text. */
export const DIRECT_ABILITIES = abilitiesFor("addy");
