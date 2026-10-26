import { useMemo, useSyncExternalStore } from "react";
import { sanitizeConfig } from "./logic";
import type { SetupConfig } from "./types";

export const STORAGE_KEY = "aurum.setup.v1";
const EVENT = "aurum-setup-change";

function read(): string {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}

/** The saved setup, or null. Anything unreadable, unknown or tampered with is cleaned or ignored. */
export function parseStored(raw: string): SetupConfig | null {
  if (!raw) return null;
  try { return sanitizeConfig(JSON.parse(raw)); } catch { return null; }
}

export function saveConfig(config: SetupConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable (private window, blocked): setup still works for this visit only */ }
}

export function clearConfig(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); window.dispatchEvent(new Event(EVENT)); } catch { /* nothing to clear */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The saved setup, kept in step across tabs and components. Null on the server and when nothing is saved. */
export function useSetupConfig(): SetupConfig | null {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseStored(raw), [raw]);
}
