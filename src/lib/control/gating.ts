import { hasFeature, type FeatureKey } from "./tiers";

/** The feature a page needs, by route. Pages not listed (Home, Settings, Tidy up files) are always available. */
const ROUTE_FEATURE: readonly [string, FeatureKey][] = [
  ["/app/contacts", "contacts"], ["/app/projects", "tasks"], ["/app/calendar", "tasks"],
  ["/app/vendors", "vendors"], ["/app/forms", "forms"], ["/app/invoices", "invoices"],
  ["/app/licenses", "licenses_basic"], ["/app/reporting", "reporting"], ["/app/activity", "activity"],
  ["/app/assistant", "assistant_rules"],
];
/** Same, by sidebar item id. */
const ITEM_FEATURE: Record<string, FeatureKey> = {
  documents: "documents", crm: "contacts", projects: "tasks", calendar: "tasks", vendors: "vendors", forms: "forms",
  invoices: "invoices", licenses: "licenses_basic", reporting: "reporting", activity: "activity", assistant: "assistant_rules",
};

export function featureForPath(path: string): FeatureKey | null {
  if (path === "/app") return "documents";
  return ROUTE_FEATURE.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1] ?? null;
}
export const pathAllowed = (features: readonly string[] | null | undefined, path: string) => {
  const need = featureForPath(path);
  return need === null || hasFeature(features, need);
};
export const itemAllowed = (features: readonly string[] | null | undefined, id: string) => {
  const need = ITEM_FEATURE[id];
  return need === undefined || hasFeature(features, need);
};
