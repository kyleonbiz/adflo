import { useMemo, useSyncExternalStore } from "react";
import { addEntry, parseAudit, type AuditEntry } from "./logic";

const KEY = "adflo.audit.v1";
const EVENT = "adflo-audit-change";

function read(): string {
  try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

/** Adds one entry, reading the latest saved log first so two pages never overwrite each other. */
export function appendAudit(entry: AuditEntry): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(addEntry(parseAudit(read()), entry)));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the page keeps working, the line is just not kept */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The saved activity log, newest first. Empty on the server. */
export function useAuditEntries(): AuditEntry[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseAudit(raw), [raw]);
}
