import { useSyncExternalStore } from "react";

const KEY = "adflo.sidebar.collapsed";
const EVENT = "adflo-sidebar-change";

const read = () => { try { return window.localStorage.getItem(KEY) === "1"; } catch { return false; } };

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(KEY, collapsed ? "1" : "0");
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the choice lasts until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Whether the desktop menu is shrunk to icons. Expanded on the server, so the first paint matches. */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
