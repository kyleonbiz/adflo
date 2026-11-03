import { useMemo, useSyncExternalStore } from "react";
import { parseSchedules, type ScheduledReport } from "./schedule";

const KEY = "adflo.scheduled-reports.v1";
const EVENT = "adflo-scheduled-reports-change";

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function saveSchedules(list: ScheduledReport[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the list lasts until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The saved schedules, kept in step across tabs. Empty on the server. */
export function useSchedules(): ScheduledReport[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseSchedules(raw), [raw]);
}
