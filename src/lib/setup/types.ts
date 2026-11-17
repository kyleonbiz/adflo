export const INDUSTRIES = [
  "Professional services", "Retail & e-commerce", "Construction & trades", "Healthcare practice",
  "Restaurant & hospitality", "Nonprofit", "Real estate", "Auto & fleet", "Home services", "Beauty & wellness",
  "Legal", "Accounting & tax", "Trucking & logistics", "Education & childcare", "Manufacturing", "Tech & agency", "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/**
 * Industries open to new sign-ups. Every industry in INDUSTRIES stays built (presets, templates, samples);
 * adding one here is all it takes to take it live. Contractors only for now.
 */
const DEFAULT_LIVE: readonly Industry[] = ["Construction & trades"];
/** NEXT_PUBLIC_LIVE_INDUSTRIES overrides it: "all", or industry names separated by "|". */
const fromEnv = (raw: string | undefined): readonly Industry[] => {
  if (!raw?.trim()) return DEFAULT_LIVE;
  if (raw.trim() === "all") return INDUSTRIES;
  const named = raw.split("|").map((s) => s.trim()).filter((s): s is Industry => (INDUSTRIES as readonly string[]).includes(s));
  return named.length ? named : DEFAULT_LIVE;
};
export const LIVE_INDUSTRIES: readonly Industry[] = fromEnv(process.env.NEXT_PUBLIC_LIVE_INDUSTRIES);

/** What a picker offers: the live industries, plus the account's current one so an existing choice is never hidden. */
export const selectableIndustries = (current?: Industry | ""): Industry[] =>
  INDUSTRIES.filter((i) => LIVE_INDUSTRIES.includes(i) || i === current);

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
