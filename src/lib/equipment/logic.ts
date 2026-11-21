import { addDays, daysBetween, formatDayLong, isDay } from "@/lib/dates";
import { csvCell } from "@/lib/csv";
import type { CalendarEvent } from "@/lib/ics";
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES, type Equipment } from "./types";

/** Within this many days, a service or inspection counts as due soon; a warranty as ending soon. */
export const DUE_SOON_DAYS = 30;
export const WARRANTY_SOON_DAYS = 60;

export type EquipmentAlert = { severity: "critical" | "warning" | "info"; message: string; href?: string };

const active = (e: Equipment) => e.status === "in_service" || e.status === "in_repair";

/** Alerts that apply today, most severe first. Retired and lost items raise none (lost ones raise one, so it is not forgotten). */
export function equipmentAlerts(e: Equipment, today: string): EquipmentAlert[] {
  const out: EquipmentAlert[] = [];
  if (e.status === "lost") return [{ severity: "warning", message: "Marked lost or missing" }];
  if (!active(e)) return out;
  const check = (day: string | null, label: string) => {
    if (!day || !isDay(day)) return;
    const left = daysBetween(today, day);
    if (left < 0) out.push({ severity: "critical", message: `${label} overdue by ${-left} day${left === -1 ? "" : "s"}` });
    else if (left <= DUE_SOON_DAYS) out.push({ severity: "warning", message: left === 0 ? `${label} due today` : `${label} due in ${left} day${left === 1 ? "" : "s"}` });
  };
  check(e.nextServiceOn, "Service");
  check(e.nextInspectionOn, "Inspection");
  if (e.warrantyEndsOn && isDay(e.warrantyEndsOn)) {
    const left = daysBetween(today, e.warrantyEndsOn);
    if (left >= 0 && left <= WARRANTY_SOON_DAYS) out.push({ severity: "info", message: `Warranty ends in ${left} day${left === 1 ? "" : "s"}` });
  }
  if (e.status === "in_repair") out.push({ severity: "info", message: "In repair" });
  const order = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export const needsAttention = (e: Equipment, today: string) => equipmentAlerts(e, today).some((a) => a.severity !== "info");

export interface EquipmentSummary { total: number; inService: number; attention: number; dueSoon: number; inRepair: number }

export function summarize(list: Equipment[], today: string): EquipmentSummary {
  let attention = 0, dueSoon = 0;
  for (const e of list) {
    const a = equipmentAlerts(e, today);
    if (a.some((x) => x.severity === "critical" || x.message === "Marked lost or missing")) attention++;
    else if (a.some((x) => x.severity === "warning")) dueSoon++;
  }
  return { total: list.length, inService: list.filter((e) => e.status === "in_service").length, attention, dueSoon, inRepair: list.filter((e) => e.status === "in_repair").length };
}

/** Records that service was done today, scheduling the next one when the item repeats. */
export function logService(e: Equipment, today: string): Equipment {
  return { ...e, lastServiceOn: today, nextServiceOn: e.serviceEveryDays ? addDays(today, e.serviceEveryDays) : null, status: e.status === "in_repair" ? "in_service" : e.status };
}

export function validateEquipment(v: { name: string; purchasedOn: string; warrantyEndsOn: string; nextServiceOn: string; nextInspectionOn: string; serviceEveryDays: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.name.trim()) errors.name = "Give it a name, like “Ford F-150” or “Rooftop unit 2”";
  else if (v.name.trim().length > 120) errors.name = "Keep the name under 120 characters";
  for (const k of ["purchasedOn", "warrantyEndsOn", "nextServiceOn", "nextInspectionOn"] as const) {
    if (v[k] && !isDay(v[k])) errors[k] = "Use a real date";
  }
  if (v.purchasedOn && v.warrantyEndsOn && isDay(v.purchasedOn) && isDay(v.warrantyEndsOn) && v.warrantyEndsOn < v.purchasedOn) errors.warrantyEndsOn = "The warranty cannot end before the purchase";
  if (v.serviceEveryDays && !/^\d{1,4}$/.test(v.serviceEveryDays)) errors.serviceEveryDays = "Whole days, like 90";
  else if (v.serviceEveryDays && Number(v.serviceEveryDays) < 1) errors.serviceEveryDays = "At least 1 day";
  return errors;
}

const typeLabel = (t: string) => EQUIPMENT_TYPES.find((x) => x.value === t)?.label ?? t;
const statusLabel = (s: string) => EQUIPMENT_STATUSES.find((x) => x.value === s)?.label ?? s;
export { typeLabel, statusLabel };

export function equipmentToCsv(list: Equipment[], today: string): string {
  const head = ["Name", "Type", "Identifier", "Status", "Location", "Assigned to", "Purchased", "Warranty ends", "Next service", "Next inspection", "Service vendor", "Alerts", "Notes"];
  const rows = list.map((e) => [e.name, typeLabel(e.type), e.identifier, statusLabel(e.status), e.location, e.assignedTo, e.purchasedOn ?? "", e.warrantyEndsOn ?? "", e.nextServiceOn ?? "", e.nextInspectionOn ?? "", e.serviceVendor, equipmentAlerts(e, today).map((a) => a.message).join("; "), e.notes]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Service, inspection and warranty dates as calendar items (retired and lost items are left out). */
export function equipmentEvents(list: Equipment[], today: string): { id: string; day: string; title: string; detail: string; late: boolean }[] {
  const out: { id: string; day: string; title: string; detail: string; late: boolean }[] = [];
  for (const e of list) {
    if (!active(e)) continue;
    const add = (key: string, day: string | null, title: string) => { if (day && isDay(day)) out.push({ id: `eq-${e.id}-${key}`, day, title, detail: e.assignedTo || e.location || "Equipment", late: day < today }); };
    add("svc", e.nextServiceOn, `Service: ${e.name}`);
    add("insp", e.nextInspectionOn, `Inspection: ${e.name}`);
    if (e.warrantyEndsOn && e.warrantyEndsOn >= today) add("war", e.warrantyEndsOn, `Warranty ends: ${e.name}`);
  }
  return out;
}

export function equipmentIcsEvents(list: Equipment[], today: string): CalendarEvent[] {
  return equipmentEvents(list, today).filter((e) => !e.late).map((e) => ({ uid: e.id, day: e.day, summary: e.title, description: e.detail }));
}

export const dueText = (day: string | null) => (day ? formatDayLong(day) : "Not set");
