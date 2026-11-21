import { MODULES, moduleHref } from "@/lib/modules/registry";
import { IMPORTABLE, runSetupChecks, setupScore } from "@/lib/setup/logic";
import { DRAFT_SERVICES } from "./guardrails";
import type { SetupConfig } from "@/lib/setup/types";

export interface Link { label: string; href: string }
export interface Turn { role: "assistant" | "user"; text: string; chips?: string[]; links?: Link[]; download?: { name: string; headers: string[]; rows: (string | number)[][] } }
interface Reply { turns: Turn[]; config: SetupConfig }

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
  const hit = DRAFT_SERVICES.find((s) => new RegExp(`\\b${{ invoices: "invoice", admin: "request", contacts: "contact", vendors: "vendor", projects: "project", licenses: "licen[sc]e", equipment: "equipment|vehicle|truck|tool" }[s.id]}s?\\b`).test(lower));
  if (!hit) return null;
  return {
    role: "assistant",
    text: `I can open ${hit.noun} for you. I only open the form: you fill it in and press save, so nothing is changed until you do.`,
    links: [{ label: `Open ${hit.noun}`, href: `${hit.path}?${hit.open}` }],
  };
}

/** One step of the conversation. Pure and read-only: it never changes `config`. */
export function respond(config: SetupConfig, input: string): Reply {
  const text = input.trim();
  const lower = text.toLowerCase();
  const user: Turn = { role: "user", text };
  const wrap = (r: Reply): Reply => ({ ...r, turns: [user, ...r.turns] });
  if (!text) return { turns: [], config };

  const draft = draftRequest(lower);
  if (draft) return wrap({ turns: [draft], config });
  if (/\b(set ?up|onboard|deploy|install)\b/.test(lower)) {
    return wrap({ turns: [{ role: "assistant", text: "Account setup is done by you in Settings, so nothing is turned on or installed by mistake. I can tell you what is left to do.", links: [{ label: "Open Settings", href: `${SETUP_PATH}?tab=setup` }], chips: [STATUS] }], config });
  }
  if (/\b(status|left|todo|to do|progress|check|health|next)\b/.test(lower)) return wrap(status(config));
  return wrap({ turns: [{ role: "assistant", text: HELP_TEXT, chips: MAIN_CHIPS }], config });
}
