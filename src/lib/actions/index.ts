import { looksSensitive } from "@/lib/assistant/guardrails";
import { ACTIONS, ALLOWED } from "./registry";
import type { ActionContext, ActionDef, Caller, Outcome } from "./types";

export * from "./types";
export { ACTIONS, ALLOWED, MAX_REMIND_DAYS } from "./registry";

export interface RunOptions {
  caller: Caller;
  /** Set only when the owner has explicitly said yes to this exact action. Needed for `confirm` actions. */
  confirmed?: boolean;
}

export const findAction = (id: string): ActionDef | undefined => ACTIONS.find((a) => a.id === id);

const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

/**
 * Runs one action. The same gates apply to every caller, in this order: the action exists, this caller may
 * run it, the owner has confirmed it if it changes a record, nothing in the input looks like a card
 * number, Social Security number or password, and the input is valid. Anything else is refused with a
 * sentence that is safe to show, and nothing is changed.
 */
export function runAction(id: string, input: unknown, ctx: ActionContext, opts: RunOptions): Outcome {
  const action = findAction(id);
  if (!action) return { ok: false, text: "I do not know how to do that." };
  if (!ALLOWED[opts.caller].includes(id)) return { ok: false, text: "I am not allowed to do that one. You can do it yourself in the service." };
  if (action.risk === "confirm" && !opts.confirmed) return { ok: false, text: "That changes a record, so it needs your yes first." };
  if (strings(input).some(looksSensitive)) {
    return { ok: false, text: "That looks like a card number, Social Security number or password, so I will not write it down. Leave those out and try again." };
  }
  const parsed = action.parse(input);
  if (!parsed.ok) return { ok: false, text: parsed.error };
  return action.run(parsed.value, ctx);
}

/** Plain-language list of what a caller may do, for help text and the model's instructions. */
export const abilitiesFor = (caller: Caller): string[] =>
  ACTIONS.filter((a) => ALLOWED[caller].includes(a.id)).map((a) => a.summary.charAt(0).toLowerCase() + a.summary.slice(1));
