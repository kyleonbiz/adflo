import { MODULES, moduleHref } from "@/lib/modules/registry";
import { AVAILABLE_MODULE_IDS, IMPORTABLE, canFinish, recommendModules, runSetupChecks, setupScore } from "@/lib/setup/logic";
import { templatesFor } from "@/lib/setup/templates";
import { INDUSTRIES, TEAM_SIZES, type Industry, type SetupConfig, type TeamSize } from "@/lib/setup/types";

export interface Link { label: string; href: string }
export interface Turn { role: "assistant" | "user"; text: string; chips?: string[]; links?: Link[] }
export type Pending = "name" | "industry" | "size" | "confirm" | null;
export interface Reply { turns: Turn[]; config: SetupConfig; pending: Pending }

const moduleName = (id: string) => MODULES.find((m) => m.id === id)?.name ?? id;
const link = (id: string): Link | null => {
  const m = MODULES.find((x) => x.id === id);
  const href = m ? moduleHref(m, "/app") : null;
  return href ? { label: moduleName(id), href } : null;
};

const START = "Set up my business";
const STATUS = "What is left to do?";
const HELP = "What can you do?";
const DEPLOY = "Deploy it";
const MAIN_CHIPS = [START, STATUS, HELP];

export function greeting(config: SetupConfig): Turn {
  if (config.completedOn) {
    return { role: "assistant", text: `Welcome back. ${config.business.name.trim()} is deployed. I can show what is left or walk you through the next steps.`, chips: [STATUS, HELP] };
  }
  return {
    role: "assistant",
    text: "Hi, I am the AdFlo assistant. I can set up your business: ask a few questions, pick the right services, install their starter templates and check the result. Where do you want to start?",
    chips: MAIN_CHIPS,
  };
}

function askNext(config: SetupConfig): Reply {
  const b = config.business;
  if (b.name.trim().length < 2) return { turns: [{ role: "assistant", text: "What is your business called?" }], config, pending: "name" };
  if (!b.industry) return { turns: [{ role: "assistant", text: `Nice to meet you, ${b.name.trim()}. What kind of business is it?`, chips: [...INDUSTRIES] }], config, pending: "industry" };
  if (!b.teamSize) return { turns: [{ role: "assistant", text: "How big is the team?", chips: [...TEAM_SIZES] }], config, pending: "size" };
  const recs = recommendModules(b.industry, b.teamSize).filter((r) => AVAILABLE_MODULE_IDS.includes(r.id));
  const next = { ...config, modules: recs.map((r) => r.id), completedOn: null };
  const list = recs.map((r) => `• ${moduleName(r.id)}: ${r.reason}`).join("\n");
  return {
    turns: [{ role: "assistant", text: `For a ${b.industry.toLowerCase()} business with ${b.teamSize.toLowerCase()}, I recommend:\n${list}\n\nI will turn these on and install their starter forms, recurring tasks and license records. Deploy?`, chips: [DEPLOY, "Not yet"] }],
    config: next,
    pending: "confirm",
  };
}

function deploy(config: SetupConfig, today: string): Reply {
  const templates = [...new Set(config.modules.flatMap((id) => templatesFor(id).map((t) => t.id)))];
  const deployed = { ...config, templates, step: 4 };
  const checks = runSetupChecks(deployed);
  const done = canFinish(checks) ? { ...deployed, completedOn: today } : deployed;
  const todo = checks.filter((c) => c.status === "warn");
  const links = done.modules.map(link).filter((l): l is Link => l !== null);
  const text = [
    `Done. ${done.modules.length} services are on and ${templates.length} templates are installed. Setup health: ${setupScore(checks)}%.`,
    todo.length > 0 ? `Still for you:\n${todo.slice(0, 6).map((c) => `• ${c.title}: ${c.detail}`).join("\n")}` : "Nothing else is needed.",
  ].join("\n\n");
  return { turns: [{ role: "assistant", text, links, chips: [STATUS] }], config: done, pending: null };
}

function status(config: SetupConfig): Reply {
  if (config.modules.length === 0) {
    return { turns: [{ role: "assistant", text: "Nothing is set up yet. Want me to do it?", chips: [START] }], config, pending: null };
  }
  const checks = runSetupChecks(config);
  const todo = checks.filter((c) => c.status !== "pass");
  const imports = config.modules.filter((id) => IMPORTABLE[id] && !config.importsDone.includes(id));
  const lines = todo.map((c) => `• ${c.title}: ${c.detail}`);
  const text = todo.length === 0
    ? `Everything checks out (${setupScore(checks)}%).`
    : `Setup health is ${setupScore(checks)}%. Open items:\n${lines.slice(0, 8).join("\n")}`;
  const links = imports.map(link).filter((l): l is Link => l !== null).slice(0, 6);
  return { turns: [{ role: "assistant", text, links, chips: config.completedOn ? undefined : [DEPLOY] }], config, pending: null };
}

const HELP_TEXT = "I can: set up your business step by step, pick services for your industry and team size, install starter templates, and tell you what is left to do. I follow fixed rules for now, so use the buttons or plain phrases such as \"set up\", \"status\" or \"help\".";

/** Matches an answer to one of the allowed choices, ignoring case and punctuation. */
function choose<T extends string>(input: string, options: readonly T[]): T | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");
  const n = norm(input);
  return n ? options.find((o) => norm(o) === n) ?? options.find((o) => norm(o).startsWith(n) && n.length >= 3) : undefined;
}

/** One step of the conversation. Pure: the caller keeps `config` and `pending` between turns. */
export function respond(config: SetupConfig, pending: Pending, input: string, today: string): Reply {
  const text = input.trim();
  const lower = text.toLowerCase();
  const user: Turn = { role: "user", text };
  const wrap = (r: Reply): Reply => ({ ...r, turns: [user, ...r.turns] });
  if (!text) return { turns: [], config, pending };

  if (pending === "name") {
    if (text.length < 2 || text.length > 80) return wrap({ turns: [{ role: "assistant", text: "Please give a name between 2 and 80 characters." }], config, pending });
    return wrap(askNext({ ...config, business: { ...config.business, name: text } }));
  }
  if (pending === "industry") {
    const industry = choose<Industry>(text, INDUSTRIES);
    if (!industry) return wrap({ turns: [{ role: "assistant", text: "Please pick one of these.", chips: [...INDUSTRIES] }], config, pending });
    return wrap(askNext({ ...config, business: { ...config.business, industry } }));
  }
  if (pending === "size") {
    const teamSize = choose<TeamSize>(text, TEAM_SIZES);
    if (!teamSize) return wrap({ turns: [{ role: "assistant", text: "Please pick one of these.", chips: [...TEAM_SIZES] }], config, pending });
    return wrap(askNext({ ...config, business: { ...config.business, teamSize } }));
  }
  if (pending === "confirm") {
    if (/^(y|yes|ok|okay|sure|go|deploy|do it|deploy it)\b/.test(lower)) return wrap(deploy(config, today));
    if (/^(n|no|not yet|later|cancel)\b/.test(lower)) {
      return wrap({ turns: [{ role: "assistant", text: "No problem. Nothing was installed. Say \"set up\" whenever you are ready.", chips: MAIN_CHIPS }], config, pending: null });
    }
    return wrap({ turns: [{ role: "assistant", text: "Shall I deploy these services?", chips: [DEPLOY, "Not yet"] }], config, pending });
  }

  if (/\b(set ?up|start|deploy|onboard|begin)\b/.test(lower)) return wrap(askNext(config));
  if (/\b(status|left|todo|to do|progress|check|health|next)\b/.test(lower)) return wrap(status(config));
  return wrap({ turns: [{ role: "assistant", text: HELP_TEXT, chips: MAIN_CHIPS }], config, pending: null });
}
