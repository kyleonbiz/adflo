import { useMemo, useSyncExternalStore } from "react";
import type { Rec } from "./diff";
import { isRemote, remoteList, remoteSettled, type SyncProblem } from "./remote";
import { SINGLE_ID, clearBrowserCopy, readBrowserCopy, subscribeRecords, writeRecords, writeSingle, type RecordKind } from "./storage";

/**
 * "Import from this browser": before a workspace was connected to the database, every service kept its records in this
 * browser. The database ignores that copy, so it can look as if it vanished. This brings it across when the person
 * chooses to. It never overwrites what the workspace already has, never imports the built-in sample records, and
 * leaves the activity trail alone (history has to be what really happened).
 */
export interface Service {
  kind: RecordKind;
  label: string;
  /** One object (settings, setup answers, approval chains) rather than a list of records. */
  single?: boolean;
}

export const SERVICES: readonly Service[] = [
  { kind: "licenses", label: "Licenses" },
  { kind: "projects", label: "Projects and tasks" },
  { kind: "invoices", label: "Invoices" },
  { kind: "vendors", label: "Vendors" },
  { kind: "contacts", label: "Contacts" },
  { kind: "todos", label: "To-dos" },
  { kind: "reminders", label: "Reminders" },
  { kind: "signing", label: "Signature requests" },
  { kind: "packets", label: "Packets" },
  { kind: "schedules", label: "Scheduled reports" },
  { kind: "projecttypes", label: "Your own project types" },
  { kind: "settings", label: "Business settings", single: true },
  { kind: "setup", label: "Guided setup answers", single: true },
  { kind: "chains", label: "Approval chains", single: true },
];

/** The largest record the database accepts. A bigger one would be refused, and retried for ever, so it is left out. */
export const MAX_RECORD_BYTES = 200_000;
/** The built-in sample records ("Small shop" and "Large company") all have ids that start with this. */
export const SAMPLE_PREFIX = "demo-";

/** What this browser holds for one service, sorted into what can be imported and what cannot. */
export interface BrowserCopy {
  service: Service;
  /** Records that can be imported. */
  usable: Rec[];
  /** Built-in sample records: never imported. */
  sample: number;
  /** Records too large for the database: left out. */
  tooLarge: number;
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length >= 1 && id.length <= 80;
const size = (r: unknown) => new TextEncoder().encode(JSON.stringify(r)).length;

/** Sorts what a browser stored for a service; `null` when there is nothing to import or say. */
export function parseBrowserCopy(service: Service, raw: string): BrowserCopy | null {
  if (!raw) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  const copy: BrowserCopy = { service, usable: [], sample: 0, tooLarge: 0 };

  if (service.single) {
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length === 0) return null;
    const rec = { ...(data as Record<string, unknown>), id: SINGLE_ID } as Rec;
    if (size(rec) > MAX_RECORD_BYTES) copy.tooLarge = 1; else copy.usable.push(rec);
  } else {
    if (!Array.isArray(data)) return null;
    for (const r of data) {
      if (!r || typeof r !== "object" || !validId((r as Rec).id)) continue; // not a record
      if ((r as Rec).id.startsWith(SAMPLE_PREFIX)) { copy.sample++; continue; }
      if (size(r) > MAX_RECORD_BYTES) { copy.tooLarge++; continue; }
      copy.usable.push(r as Rec);
    }
  }
  return copy.usable.length + copy.sample + copy.tooLarge > 0 ? copy : null;
}

/** What would be added to the workspace's records, leaving everything already there exactly as it is. */
export function planMerge(copy: BrowserCopy, existing: readonly Rec[] | null): { next: Rec[]; add: number; alreadyThere: number } {
  const have = new Set((existing ?? []).map((r) => r.id));
  const fresh = copy.usable.filter((r) => !have.has(r.id));
  return { next: [...(existing ?? []), ...fresh], add: fresh.length, alreadyThere: copy.usable.length - fresh.length };
}

/** Everything this browser holds that could be imported, one entry per service that has anything. */
export function findBrowserCopies(): BrowserCopy[] {
  return SERVICES.map((s) => parseBrowserCopy(s, readBrowserCopy(s.kind))).filter((c): c is BrowserCopy => c !== null);
}

/** What this browser holds that could be imported, kept up to date as it changes. `null` on the server and before the browser is read. */
export function useBrowserCopies(): BrowserCopy[] | null {
  const signature = useSyncExternalStore(subscribeRecords, () => SERVICES.map((s) => readBrowserCopy(s.kind)).join("\u0000"), () => null);
  return useMemo(() => (signature === null ? null : findBrowserCopies()), [signature]);
}

export interface ImportReport {
  service: Service;
  added: number;
  alreadyThere: number;
  sample: number;
  tooLarge: number;
  /** Why the database did not take it, if it did not. */
  problem: SyncProblem | null;
}

/** Imports the chosen services into the workspace, then reports what the database actually accepted. */
export async function importFromBrowser(kinds: readonly RecordKind[]): Promise<ImportReport[]> {
  const reports: ImportReport[] = [];
  for (const kind of kinds) {
    const service = SERVICES.find((s) => s.kind === kind);
    const copy = service ? parseBrowserCopy(service, readBrowserCopy(kind)) : null;
    if (!service || !copy || !isRemote(kind)) continue; // only into a connected workspace, never back into this browser
    const existing = remoteList(kind);
    const plan = planMerge(copy, existing);
    if (plan.add > 0) {
      if (service.single) writeSingle(kind, withoutId(plan.next.find((r) => r.id === SINGLE_ID)!));
      else writeRecords(kind, plan.next);
    }
    reports.push({ service, added: plan.add, alreadyThere: plan.alreadyThere, sample: copy.sample, tooLarge: copy.tooLarge, problem: null });
  }
  const problems = await remoteSettled(reports.map((r) => r.service.kind));
  for (const r of reports) r.problem = r.added > 0 ? problems[r.service.kind] ?? null : null;
  return reports;
}

const withoutId = (r: Rec): object => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "id"));

/** Removes this browser's old copy of what was imported (never touches the workspace). */
export function removeBrowserCopies(kinds: readonly RecordKind[]): void {
  for (const k of kinds) clearBrowserCopy(k);
}
