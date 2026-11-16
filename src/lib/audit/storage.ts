import { useMemo, useSyncExternalStore } from "react";
import { RECORDS_EVENT } from "@/lib/records/remote";
import { addEntry, parseAudit, type AuditEntry } from "./logic";
import { activityActive, activityList, appendActivity } from "./remote";

const KEY = "adflo.audit.v1";
const EVENT = "adflo-audit-change";

function read(): string {
  try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

/**
 * Adds one entry. With a database connected the line goes to the workspace's append-only trail; otherwise it is kept in
 * this browser, reading the latest saved log first so two pages never overwrite each other.
 */
export function appendAudit(entry: AuditEntry): void {
  if (activityActive()) { appendActivity(entry); return; }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(addEntry(parseAudit(read()), entry)));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the page keeps working, the line is just not kept */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener(RECORDS_EVENT, onChange); // the workspace's trail changed
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener(RECORDS_EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The saved activity log, newest first: the workspace's trail when a database is connected, this browser's otherwise. Empty on the server. */
export function useAuditEntries(): AuditEntry[] {
  const remote = useSyncExternalStore(subscribe, activityList, () => null);
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => remote ?? parseAudit(raw), [remote, raw]);
}
