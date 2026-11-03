import { useMemo, useSyncExternalStore } from "react";
import { parseReminders, type Reminder } from "./logic";

const KEY = "adflo.reminders.v1";
const EVENT = "adflo-reminders-change";

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function saveReminders(list: Reminder[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: reminders last until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Reminders set with "Remind me", kept in this browser. Empty on the server. */
export function useReminders(): Reminder[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseReminders(raw), [raw]);
}
