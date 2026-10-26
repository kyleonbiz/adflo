export const INDUSTRIES = [
  "Professional services", "Retail & e-commerce", "Construction & trades", "Healthcare practice",
  "Restaurant & hospitality", "Nonprofit", "Real estate", "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const TEAM_SIZES = ["Just me", "2-5 people", "6-20 people", "21+ people"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const STEPS = ["Business", "Modules", "Templates", "Your data", "Review"] as const;

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
