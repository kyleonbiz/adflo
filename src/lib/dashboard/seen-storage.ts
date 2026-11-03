import { useMemo, useSyncExternalStore } from "react";
import { parseSeen } from "./prefs";

const KEY = "adflo.notifications.seen.v1";
const EVENT = "adflo-notifications-seen-change";

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function saveSeen(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: "new" markers reset on reload */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Ids shown the last time the bell was closed. */
export function useSeen(): string[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseSeen(raw), [raw]);
}
