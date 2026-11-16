import { useMemo } from "react";
import { clearSingle, useSingleRaw, writeSingle } from "@/lib/records/storage";
import { sanitizeConfig } from "./logic";
import type { SetupConfig } from "./types";

/** Where the preview keeps the setup in this browser (the records layer uses it; with a database it is saved to the workspace). */
export const STORAGE_KEY = "aurum.setup.v1";

/** The saved setup, or null. Anything unreadable, unknown or tampered with is cleaned or ignored. */
export function parseStored(raw: string): SetupConfig | null {
  if (!raw) return null;
  try { return sanitizeConfig(JSON.parse(raw)); } catch { return null; }
}

/** Saves the setup: to the workspace database when one is connected, otherwise in this browser. */
export function saveConfig(config: SetupConfig): void {
  writeSingle("setup", config);
}

/** "Start over": forgets the saved setup. */
export function clearConfig(): void {
  clearSingle("setup");
}

/** The saved setup, kept in step across tabs and components. Null on the server and when nothing is saved. */
export function useSetupConfig(): SetupConfig | null {
  const raw = useSingleRaw("setup");
  return useMemo(() => parseStored(raw), [raw]);
}
