import { useMemo, useSyncExternalStore } from "react";
import { parseCustomTypes } from "./custom-types";
import type { ProjectTemplate } from "./templates";

const KEY = "adflo.project-types.v1";
const EVENT = "adflo-project-types-change";

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function saveCustomTypes(list: ProjectTemplate[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the types last until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The project types you added yourself. Empty on the server. */
export function useCustomTypes(): ProjectTemplate[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseCustomTypes(raw), [raw]);
}
