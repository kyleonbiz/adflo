import { useMemo, useSyncExternalStore } from "react";
import { parseSnoozed, type Snoozed } from "./snooze";

const KEY = "adflo.dashboard.snoozed.v1";
const EVENT = "adflo-dashboard-snooze-change";

function read(): string {
  try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function saveSnoozed(s: Snoozed): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the snooze lasts until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

export function useSnoozed(): Snoozed {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseSnoozed(raw), [raw]);
}
