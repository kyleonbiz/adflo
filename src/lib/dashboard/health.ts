import { addDays, daysBetween } from "@/lib/dates";
import { equipmentEvents } from "@/lib/equipment/logic";
import { missingDocuments } from "@/lib/licenses/logic";
import { docState } from "@/lib/vendors/logic";
import type { DashboardSources } from "./logic";

/** What counts as "coming up": dates this many days ahead are listed, and renewals this close are counted. */
export const HEALTH_WINDOW_DAYS = 60;
/** "Tasks completed" counts the last this many days. */
export const COMPLETED_WINDOW_DAYS = 30;
/** The attention list shows at most this many rows. */
export const HEALTH_ROWS = 8;

export interface HealthTile { id: "documents" | "assets" | "renewals" | "tasks"; label: string; value: number; href: string; note: string }
export interface HealthRow {
  id: string;
  /** What it is, e.g. "General liability insurance". */
  label: string;
  /** Where it comes from, e.g. "License" or "Vendor: Blue Ridge". */
  detail: string;
  /** Days until it is due (negative once late), or null for a record that is simply missing. */
  days: number | null;
  tone: "danger" | "warning" | "neutral";
  href: string;
}
export interface Health {
  tiles: HealthTile[];
  rows: HealthRow[];
  /** All the rows there are, before the list is cut to HEALTH_ROWS. */
  total: number;
  status: "clear" | "watch" | "attention";
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * The administrative health of the business: how much AdFlo is holding, and what needs attention soonest, brought together from
 * licenses and insurance, vendor documents, equipment and tasks. Pure; `documents` is the count of stored documents when known.
 */
export function buildHealth(src: DashboardSources, today: string, base: string, documents: number | null): Health {
  const rows: HealthRow[] = [];
  const horizon = addDays(today, HEALTH_WINDOW_DAYS);
  const tone = (days: number | null): HealthRow["tone"] => (days === null ? "neutral" : days < 0 ? "danger" : days <= 30 ? "warning" : "neutral");
  let renewals = 0;

  for (const l of src.licenses) {
    const days = daysBetween(today, l.expiresOn);
    if (days <= HEALTH_WINDOW_DAYS) {
      rows.push({ id: `lic-${l.id}`, label: l.name, detail: l.category === "insurance" ? "Insurance" : "License", days, tone: tone(days), href: `${base}/licenses` });
      if (days >= 0) renewals++;
    }
    const missing = missingDocuments(l);
    if (missing > 0 && days >= 0) rows.push({ id: `licdocs-${l.id}`, label: `${l.name}: ${plural(missing, "document")} missing`, detail: "License", days: null, tone: "neutral", href: `${base}/licenses` });
  }
  for (const v of src.vendors) {
    if (v.status === "inactive") continue;
    for (const d of v.documents) {
      if (!d.required) continue;
      const state = docState(d, today);
      if (state === "missing") { rows.push({ id: `vd-${v.id}-${d.id}`, label: `${d.type} missing`, detail: `Vendor: ${v.name}`, days: null, tone: "neutral", href: `${base}/vendors` }); continue; }
      if (d.expiresOn && d.expiresOn <= horizon) {
        const days = daysBetween(today, d.expiresOn);
        rows.push({ id: `vd-${v.id}-${d.id}`, label: `${d.type} ${days < 0 ? "expired" : "expires"}`, detail: `Vendor: ${v.name}`, days, tone: tone(days), href: `${base}/vendors` });
        if (days >= 0) renewals++;
      }
    }
  }
  for (const e of equipmentEvents(src.equipment ?? [], today)) {
    if (e.id.endsWith("-war")) continue;
    const days = daysBetween(today, e.day);
    if (days <= HEALTH_WINDOW_DAYS) rows.push({ id: e.id, label: e.title, detail: "Equipment", days, tone: tone(days), href: `${base}/equipment` });
  }

  // Late first, then records that are missing, then what is due soonest.
  rows.sort((a, b) => {
    const rank = (r: HealthRow) => (r.days !== null && r.days < 0 ? 0 : r.days === null ? 1 : 2);
    return rank(a) - rank(b) || (a.days ?? 0) - (b.days ?? 0) || a.label.localeCompare(b.label);
  });

  const since = addDays(today, -COMPLETED_WINDOW_DAYS);
  const completed = src.projects.flatMap((p) => p.tasks).filter((t) => t.done && t.doneOn && t.doneOn >= since && t.doneOn <= today).length;
  const assets = (src.equipment ?? []).filter((e) => e.status === "in_service" || e.status === "in_repair").length;

  const tiles: HealthTile[] = [
    ...(documents === null ? [] : [{ id: "documents" as const, label: "Documents stored", value: documents, href: "/app", note: "In your workspace" }]),
    { id: "assets", label: "Assets tracked", value: assets, href: `${base}/equipment`, note: "Tools, vehicles and equipment" },
    { id: "renewals", label: "Upcoming renewals", value: renewals, href: `${base}/licenses`, note: `Next ${HEALTH_WINDOW_DAYS} days` },
    { id: "tasks", label: "Tasks completed", value: completed, href: `${base}/projects`, note: `Last ${COMPLETED_WINDOW_DAYS} days` },
  ];
  return {
    tiles, rows: rows.slice(0, HEALTH_ROWS), total: rows.length,
    status: rows.some((r) => r.days !== null && r.days < 0) ? "attention" : rows.length > 0 ? "watch" : "clear",
  };
}
