import { useMemo, useSyncExternalStore } from "react";
import { parseChains, type ChainConfig } from "./chain";

const KEY = "adflo.approval-chains.v1";
const EVENT = "adflo-approval-chains-change";

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function saveChains(c: ChainConfig): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(c));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the chains last until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The approval chains set in Settings. Empty on the server. */
export function useChains(): ChainConfig {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseChains(raw), [raw]);
}
