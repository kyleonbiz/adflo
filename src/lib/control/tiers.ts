/**
 * What each plan includes. A plan's `features` is the list of keys below; an empty/absent list on a legacy plan
 * (such as "standard") means "everything", so existing clients lose nothing until they are moved onto a tier.
 */
export const FEATURES = [
  { key: "documents", label: "Documents", group: "Modules" },
  { key: "contacts", label: "Contacts", group: "Modules" },
  { key: "tasks", label: "Tasks & calendar", group: "Modules" },
  { key: "setup", label: "Guided industry setup", group: "Modules" },
  { key: "licenses_basic", label: "Licenses (basic list)", group: "Modules" },
  { key: "vendors", label: "Vendors", group: "Modules" },
  { key: "licenses", label: "Licenses (full tracking & compliance)", group: "Modules" },
  { key: "forms", label: "Forms & signing", group: "Modules" },
  { key: "invoices", label: "Invoices", group: "Modules" },
  { key: "projects", label: "Projects", group: "Modules" },
  { key: "reporting", label: "Reporting (basic)", group: "Modules" },
  { key: "versioning", label: "Document versioning", group: "Extras" },
  { key: "assistant_rules", label: "Assistant (rules-based)", group: "Extras" },
  { key: "reporting_scheduled", label: "Scheduled reports", group: "Extras" },
  { key: "certifications", label: "Certifications", group: "Extras" },
  { key: "activity", label: "Activity log & audit trail", group: "Extras" },
  { key: "assistant_ai", label: "Assistant (Claude-backed)", group: "Extras" },
  { key: "ocr", label: "OCR of license & vendor photos", group: "Extras" },
  { key: "priority_support", label: "Priority support", group: "Extras" },
] as const;
export type FeatureKey = (typeof FEATURES)[number]["key"];
export const FEATURE_KEYS: readonly string[] = FEATURES.map((f) => f.key);

export const CORE: FeatureKey[] = [
  "documents", "contacts", "tasks", "setup", "licenses_basic", "vendors", "licenses", "forms", "invoices", "projects", "reporting",
  "versioning", "assistant_rules", "reporting_scheduled", "certifications", "activity",
];
const AI: FeatureKey[] = [...CORE, "assistant_ai", "ocr", "priority_support"];

/** What the plan includes, in numbers. Single source for the landing page, app and Control center. */
export interface PlanLimits {
  /** Monthly platform price in cents (includes the owner's seat). */
  priceCents: number;
  /** Each additional seat, per month, in cents. */
  seatCents: number;
  /** Annual platform price in cents (two months free). */
  annualCents: number;
  /** Each additional seat, per year, in cents (two months free). */
  seatAnnualCents: number;
  /** Seats included in the platform price. */
  seats: number;
  storageGb: number;
  maxFileMb: number;
  /** Claude (approval-based) actions per month. */
  aiActions: number;
  ocrPerMonth: number;
  /** Rough input+output token backstop per month. */
  tokenBackstop: number | null;
}

export const TRIAL_DAYS = 14;
/** Add-ons. An extra seat is the same $10 the plan charges per seat. Prices in cents. */
export const ADD_ONS = [
  { label: "Extra seat", priceCents: 1000, per: "seat" },
  { label: "Extra 10 GB of storage", priceCents: 1000, per: "10 GB" },
  { label: "Extra 250 Claude actions", priceCents: 1500, per: "250 actions" },
] as const;

/** The one plan: $65 a month with the owner's seat, plus $10 a month for each additional seat. Everything is included. */
export const PRICE_CENTS = 6500;
export const SEAT_CENTS = 1000;
export const TIERS: readonly { name: string; label: string; audience: string; blurb: string; seatsIncluded: number; features: readonly FeatureKey[]; limits: PlanLimits; support: string }[] = [
  {
    name: "adflo", label: "AdFlo", seatsIncluded: 1, features: AI,
    audience: "Contractors and property managers, from a one-person shop to a multi-crew team",
    blurb: "The whole administrative platform for one price: every module, the Claude-backed assistant, OCR and priority support.",
    support: "Priority support",
    limits: { priceCents: PRICE_CENTS, seatCents: SEAT_CENTS, annualCents: PRICE_CENTS * 10, seatAnnualCents: SEAT_CENTS * 10, seats: 1, storageGb: 20, maxFileMb: 50, aiActions: 250, ocrPerMonth: 200, tokenBackstop: 3_000_000 },
  },
];

/** What a team of this size pays each month: the platform price plus each seat after the first. */
export const monthlyCents = (seats: number): number => PRICE_CENTS + Math.max(0, Math.floor(seats) - 1) * SEAT_CENTS;

/** The limits for a plan name (case-insensitive), or null for a retired or legacy plan. */
export const limitsFor = (plan: string): PlanLimits | null => TIERS.find((t) => t.name === plan.trim().toLowerCase())?.limits ?? null;

/** True when a plan with these features includes `key`. `null` (a legacy plan with no list) includes everything. */
export const hasFeature = (features: readonly string[] | null | undefined, key: FeatureKey) =>
  features == null || features.includes(key);

/** Keep only known feature keys, without repeats. */
export const cleanFeatures = (raw: readonly unknown[]): FeatureKey[] =>
  [...new Set(raw.filter((k): k is FeatureKey => typeof k === "string" && FEATURE_KEYS.includes(k)))];
