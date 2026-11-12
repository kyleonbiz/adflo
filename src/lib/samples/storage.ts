import { useMemo, useSyncExternalStore } from "react";
import { remoteActive } from "@/lib/records/remote";
import { clearRecords, writeRecords, type RecordKind } from "@/lib/records/storage";
import { SAMPLE_SETS, type SampleRecords, type SampleSetId } from "./data";

const KEY = "adflo.sample-set.v1";
const EVENT = "adflo-sample-change";
const KINDS: RecordKind[] = ["invoices", "licenses", "vendors", "contacts", "projects"];

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Which sample set is loaded, or null. Sample data is only ever loaded by pressing a button, never mixed into real records silently. */
export function useLoadedSample(): SampleSetId | null {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => (SAMPLE_SETS.some((s) => s.id === raw) ? (raw as SampleSetId) : null), [raw]);
}

/** Replaces every service's records with the chosen sample set. */
export function loadSample(id: SampleSetId, today: string): void {
  const set = SAMPLE_SETS.find((s) => s.id === id);
  if (!set || remoteActive()) return; // never put sample records into a real workspace
  const data: SampleRecords = set.build(today);
  for (const kind of KINDS) writeRecords<unknown>(kind, data[kind]);
  try { window.localStorage.setItem(KEY, id); } catch { /* the marker is a convenience */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Empties every service and forgets the sample marker: back to the blank start. */
export function clearAllRecords(): void {
  if (remoteActive()) return;
  for (const kind of KINDS) clearRecords(kind);
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
  window.dispatchEvent(new Event(EVENT));
}
