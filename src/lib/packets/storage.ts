import { useMemo, useSyncExternalStore } from "react";
import { parseAssignments, type Assignment } from "./logic";

const KEY = "adflo.packets.v1";
const EVENT = "adflo-packets-change";

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function saveAssignments(list: Assignment[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: packets last until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The packets handed out so far, kept in this browser. Empty on the server. */
export function useAssignments(): Assignment[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseAssignments(raw), [raw]);
}
