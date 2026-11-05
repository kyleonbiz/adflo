/**
 * What each plan includes. A plan's `features` is the list of keys below; an empty/absent list on a legacy plan
 * (such as "standard") means "everything", so existing clients lose nothing until they are moved onto a tier.
 */
export const FEATURES = [
  { key: "documents", label: "Documents", group: "Modules" },
  { key: "contacts", label: "Contacts", group: "Modules" },
  { key: "tasks", label: "Tasks & Calendar", group: "Modules" },
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

const ESSENTIALS: FeatureKey[] = ["documents", "contacts", "tasks", "setup", "licenses_basic"];
const BUSINESS: FeatureKey[] = [...ESSENTIALS, "vendors", "licenses", "forms", "invoices", "projects", "reporting", "versioning", "assistant_rules"];
const COMPLETE: FeatureKey[] = [...BUSINESS, "reporting_scheduled", "certifications", "activity", "assistant_ai", "ocr", "priority_support"];

/** The tiers offered, in order. Seats are included seats; prices are set separately by the Owner. */
export const TIERS: readonly { name: string; blurb: string; seatsIncluded: number; features: readonly FeatureKey[] }[] = [
  { name: "essentials", blurb: "Solo owners and very small teams getting organized.", seatsIncluded: 3, features: ESSENTIALS },
  { name: "business", blurb: "Small teams with licenses, vendors, paperwork and billing.", seatsIncluded: 10, features: BUSINESS },
  { name: "complete", blurb: "Regulated or multi-role businesses that want automation and oversight.", seatsIncluded: 25, features: COMPLETE },
];

/** True when a plan with these features includes `key`. `null` (a legacy plan with no list) includes everything. */
export const hasFeature = (features: readonly string[] | null | undefined, key: FeatureKey) =>
  features == null || features.includes(key);

/** Keep only known feature keys, without repeats. */
export const cleanFeatures = (raw: readonly unknown[]): FeatureKey[] =>
  [...new Set(raw.filter((k): k is FeatureKey => typeof k === "string" && FEATURE_KEYS.includes(k)))];
