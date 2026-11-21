import { MODULES, moduleHref } from "@/lib/modules/registry";
import { IMPORTABLE, runSetupChecks, setupScore } from "@/lib/setup/logic";
import { DRAFT_SERVICES } from "./guardrails";
import type { SetupConfig } from "@/lib/setup/types";

export interface Link { label: string; href: string }
export interface Turn { role: "assistant" | "user"; text: string; chips?: string[]; links?: Link[]; download?: { name: string; headers: string[]; rows: (string | number)[][] } }
/** `matched` is true when a fixed rule recognised the request; false means it only fell back to the help text, so the caller may hand it to the AI model. */
interface Reply { turns: Turn[]; config: SetupConfig; matched?: boolean }

const link = (id: string): Link | null => {
  const m = MODULES.find((x) => x.id === id);
  const href = m ? moduleHref(m, "/app") : null;
  return href ? { label: m!.name, href } : null;
};

const STATUS = "What is left to do?";
const HELP = "What can you do?";
const MAIN_CHIPS = [STATUS, "New invoice", HELP];
const SETUP_PATH = "/app/setup";

export function greeting(config: SetupConfig): Turn {
  const name = config.business.name.trim();
  return {
    role: "assistant",
    text: `${name ? `Welcome back, ${name}. ` : "Hi, "}I am Addy, the AdFlo assistant. Ask me how something works, what is coming up, or have me open a draft in a service for you to review. Account setup is done by you in Settings.`,
    chips: MAIN_CHIPS,
  };
}

/** Read-only: lists what Settings still shows as open. Changes nothing. */
function status(config: SetupConfig): Reply {
  const setupLink = { label: "Open Settings", href: `${SETUP_PATH}?tab=setup` };
  if (config.modules.length === 0) {
    return { turns: [{ role: "assistant", text: "Nothing is set up yet. You set up your services in Settings.", links: [setupLink], chips: [HELP] }], config };
  }
  const checks = runSetupChecks(config);
  const todo = checks.filter((c) => c.status !== "pass");
  const imports = config.modules.filter((id) => IMPORTABLE[id] && !config.importsDone.includes(id));
  const lines = todo.map((c) => `• ${c.title}: ${c.detail}`);
  const text = todo.length === 0
    ? `Everything checks out (${setupScore(checks)}%).`
    : `Setup health is ${setupScore(checks)}%. Open items:\n${lines.slice(0, 8).join("\n")}`;
  const links = [setupLink, ...imports.map(link).filter((l): l is Link => l !== null)].slice(0, 6);
  return { turns: [{ role: "assistant", text, links }], config };
}

const HELP_TEXT = "I can answer questions about AdFlo and your records, tell you what is left to do in Settings, and open a new invoice, contact, vendor, project or license form with the details filled in. I can also add something to your to-do list for today, set a reminder (for example, remind me to renew the permit in 3 days) and tick off a to-do, and each of those has an Undo. I can run a report on your records, explain it in plain words and export it to CSV or Excel, for example \"run a report on invoices\", \"explain the vendor report\", \"export invoices to Excel\" or \"how are we doing\". I do not set up your account: you do that in Settings. Apart from the actions above, I only open forms: you fill them in and save, and I never delete, approve, pay, send or sign anything.";

/** "New invoice", "add a contact": opens that service's blank form. The assistant only opens it; the owner fills in and saves. */
function draftRequest(lower: string): Turn | null {
  if (!/\b(new|add|create|draft|make|start)\b/.test(lower)) return null;
  const hit = DRAFT_SERVICES.find((s) => new RegExp(`\\b${{ invoices: "invoice", admin: "request", contacts: "contact", vendors: "vendor", projects: "project", licenses: "licen[sc]e" }[s.id]}s?\\b`).test(lower));
  if (!hit) return null;
  return {
    role: "assistant",
    text: `I can open ${hit.noun} for you. I only open the form: you fill it in and press save, so nothing is changed until you do.`,
    links: [{ label: `Open ${hit.noun}`, href: `${hit.path}?${hit.open}` }],
  };
}

/** Open-ended questions go to the AI model; the rules only take them when they are one of the buttons or a plain help request. */
const QUESTION = /^(how|why|where|when|which|who|can|could|should|does|do|is|are|what|whats|what's)\b/;
const HELP_ASK = /^(help|what can you do|what do you do)\b/;
const STATUS_ASK = /^(what('?s| is) (left|next)|where (am i|are we) at)\b/;

/**
 * One step of the conversation, by fixed rules. Pure and read-only: it never changes `config`.
 * `matched` says whether a rule answered. Short, plain requests are answered here for free; anything else is
 * reported as unmatched so the AI model (when on) can take it.
 */
export function respond(config: SetupConfig, input: string): Reply {
  const text = input.trim();
  const lower = text.toLowerCase();
  const user: Turn = { role: "user", text };
  const wrap = (r: Reply): Reply => ({ ...r, turns: [user, ...r.turns] });
  if (!text) return { turns: [], config, matched: true };

  const words = text.split(/\s+/).length;
  const question = QUESTION.test(lower);

  if (lower === HELP.toLowerCase() || HELP_ASK.test(lower)) return wrap({ turns: [{ role: "assistant", text: HELP_TEXT, chips: MAIN_CHIPS }], config, matched: true });
  if (!question) {
    const draft = draftRequest(lower);
    if (draft) return wrap({ turns: [draft], config, matched: true });
    if (words <= 8 && /\b(set ?up|onboard|deploy|install)\b/.test(lower)) {
      return wrap({ turns: [{ role: "assistant", text: "Account setup is done by you in Settings, so nothing is turned on or installed by mistake. I can tell you what is left to do.", links: [{ label: "Open Settings", href: `${SETUP_PATH}?tab=setup` }], chips: [STATUS] }], config, matched: true });
    }
  }
  if (lower === STATUS.toLowerCase() || STATUS_ASK.test(lower) || (!question && words <= 6 && /\b(status|left|todo|to do|progress|health|next)\b/.test(lower))) return wrap({ ...status(config), matched: true });
  return wrap({ turns: [{ role: "assistant", text: HELP_TEXT, chips: MAIN_CHIPS }], config, matched: false });
}
