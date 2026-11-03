import { useMemo, useSyncExternalStore } from "react";
import { industryChains } from "@/lib/setup/industries";
import { useSetupConfig } from "@/lib/setup/storage";
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

/** The saved chains, with the industry's suggestion filling in any kind that was never set by hand. Empty on the server. */
export function useChains(): ChainConfig {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const setup = useSetupConfig();
  return useMemo(() => {
    const saved = parseChains(raw);
    const suggested = industryChains(setup);
    return { requests: saved.requests.length ? saved.requests : suggested.requests, forms: saved.forms.length ? saved.forms : suggested.forms };
  }, [raw, setup]);
}
