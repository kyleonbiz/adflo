/**
 * What the plan includes. A plan's `features` is the list of keys below; an empty/absent list on a legacy plan
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

/** Every feature: AdFlo is sold as one plan, so everything is included. */
const ALL: FeatureKey[] = FEATURES.map((f) => f.key);

/** The one plan offered: $149 a month, everything included (Addy, OCR and priority support too), a 14-day trial and annual billing at two months free. */
export const PRICE_CENTS = 14900;
export const ANNUAL_PRICE_CENTS = 149000;
export const TRIAL_DAYS = 14;
export const TIERS: readonly { name: string; blurb: string; seatsIncluded: number; priceCents: number; features: readonly FeatureKey[] }[] = [
  { name: "adflo", blurb: "The whole platform for one price: every module, the Addy assistant, OCR and priority support, for your whole team.", seatsIncluded: 50, priceCents: PRICE_CENTS, features: ALL },
];

/** True when a plan with these features includes `key`. `null` (a legacy plan with no list) includes everything. */
export const hasFeature = (features: readonly string[] | null | undefined, key: FeatureKey) =>
  features == null || features.includes(key);

/** Keep only known feature keys, without repeats. */
export const cleanFeatures = (raw: readonly unknown[]): FeatureKey[] =>
  [...new Set(raw.filter((k): k is FeatureKey => typeof k === "string" && FEATURE_KEYS.includes(k)))];
