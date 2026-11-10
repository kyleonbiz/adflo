import type { Contact } from "@/lib/contacts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Reminder } from "@/lib/reminders/logic";
import type { Todo } from "@/lib/todos/logic";

/**
 * The action layer: every change the app can make on a person's behalf, as one typed, validated, undoable step.
 *
 * Buttons, schedules and Addy all go through here, so the rules live in one place. An action is a pure
 * function over a snapshot of the saved lists; the caller saves what comes back. Nothing in this layer
 * touches storage, the network or the screen, so it works the same on browser records today and on
 * database rows later.
 */

/** The saved lists an action may read and change. */
export interface ActionState {
  todos: Todo[];
  reminders: Reminder[];
  contacts: Contact[];
  invoices: Invoice[];
}

/** The lists an action changed, whole, ready to save. Lists it did not touch are absent. */
export type Changes = Partial<ActionState>;

export interface ActionLink { label: string; href: string }

/** What a successful action leaves in the activity log. */
export interface AuditNote { verb: string; detail: string; area: string; href: string }

export interface ActionContext {
  state: ActionState;
  /** The browser's day, `YYYY-MM-DD`. */
  today: string;
  newId: () => string;
}

/**
 * What happened. `ok: false` means nothing was done and `text` says why. `ok: true` with no `changes`
 * means the request was already satisfied (for example the to-do was already on the list).
 * `undo` holds the same lists as they were before, so putting them back reverses the action.
 */
export interface Outcome {
  ok: boolean;
  text: string;
  link?: ActionLink;
  changes?: Changes;
  undo?: Changes;
  audit?: AuditNote;
}

export type Parsed<I> = { ok: true; value: I } | { ok: false; error: string };

/**
 * `safe`: adds to or ticks off the owner's own lists and can be undone with one tap.
 * `confirm`: changes the state of an existing service record (a payment, a renewal), so whoever runs it
 * must say they have the owner's explicit yes.
 */
export type Risk = "safe" | "confirm";

/** Who is asking. Each caller has its own list of actions it may run. */
export type Caller = "app" | "addy";

export interface ActionDef<I = unknown> {
  id: string;
  /** One plain sentence, used in help text and in the model's instructions. */
  summary: string;
  area: string;
  risk: Risk;
  parse(input: unknown): Parsed<I>;
  run(input: I, ctx: ActionContext): Outcome;
}
