export const INDUSTRIES = [
  "Professional services", "Retail & e-commerce", "Construction & trades", "Healthcare practice",
  "Restaurant & hospitality", "Nonprofit", "Real estate", "Auto & fleet", "Home services", "Beauty & wellness",
  "Legal", "Accounting & tax", "Trucking & logistics", "Education & childcare", "Manufacturing", "Tech & agency", "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/**
 * Industries open to new sign-ups. Every industry in INDUSTRIES stays built (presets, templates, samples); the
 * Owner opens or closes each one in Control center > Industries, which saves the list in `live_industries`.
 * Contractors only until that says otherwise.
 */
export const DEFAULT_LIVE: readonly Industry[] = ["Construction & trades"];
/** NEXT_PUBLIC_LIVE_INDUSTRIES (the fallback when nothing is saved, and for tests): "all", or industry names separated by "|". */
const fromEnv = (raw: string | undefined): readonly Industry[] => {
  if (!raw?.trim()) return DEFAULT_LIVE;
  if (raw.trim() === "all") return INDUSTRIES;
  const named = raw.split("|").map((s) => s.trim()).filter((s): s is Industry => (INDUSTRIES as readonly string[]).includes(s));
  return named.length ? named : DEFAULT_LIVE;
};
export const FALLBACK_LIVE: readonly Industry[] = fromEnv(process.env.NEXT_PUBLIC_LIVE_INDUSTRIES);

let live: readonly Industry[] = FALLBACK_LIVE;
/** The industries open right now. The app shell (browser) and the assistant route (server) set it from the database. */
export const liveIndustries = (): readonly Industry[] => live;
export const setLiveIndustries = (list: readonly Industry[] | null | undefined) => { live = list && list.length ? list : FALLBACK_LIVE; };

/** Turns saved rows into the live list, ignoring unknown names. Nothing saved (or nothing on) means the fallback. */
export function liveFromRows(rows: readonly { industry: string; live: boolean }[] | null | undefined): readonly Industry[] {
  if (!rows || rows.length === 0) return FALLBACK_LIVE;
  const on = INDUSTRIES.filter((i) => rows.some((r) => r.industry === i && r.live));
  return on.length ? on : FALLBACK_LIVE;
}

/** Why a switch cannot be flipped, or null when it can. At least one industry must stay open. */
export function toggleError(current: readonly Industry[], industry: string, on: boolean): string | null {
  if (!(INDUSTRIES as readonly string[]).includes(industry)) return "Unknown industry.";
  if (!on && current.length === 1 && current[0] === industry) return "At least one industry must stay open.";
  return null;
}

/** What a picker offers: the open industries, plus the account's current one so an existing choice is never hidden. */
export const selectableIndustries = (current?: Industry | "", open: readonly Industry[] = live): Industry[] =>
  INDUSTRIES.filter((i) => open.includes(i) || i === current);

export const TEAM_SIZES = ["Just me", "2-5 people", "6-20 people", "21+ people"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const STEPS = ["Business", "Services", "Templates", "Your data", "Review"] as const;

export interface SetupConfig {
  version: 1;
  /** Index into STEPS the wizard was last on. */
  step: number;
  business: { name: string; industry: Industry | ""; teamSize: TeamSize | "" };
  /** Module ids the business chose. */
  modules: string[];
  /** Template ids installed into those modules. */
  templates: string[];
  /** Module ids whose existing data the user marked as imported. */
  importsDone: string[];
  /** The day setup was finished, or null while in progress. */
  completedOn: string | null;
}

export const emptyConfig = (): SetupConfig => ({
  version: 1, step: 0, business: { name: "", industry: "", teamSize: "" }, modules: [], templates: [], importsDone: [], completedOn: null,
});

export type CheckStatus = "pass" | "warn" | "fail";
export interface SetupCheck {
  id: string;
  status: CheckStatus;
  title: string;
  detail: string;
  /** The wizard step that fixes it. */
  step: number;
}
