import { useMemo } from "react";
import { useSingleRaw, writeSingle } from "@/lib/records/storage";
import { industryChains } from "@/lib/setup/industries";
import { useSetupConfig } from "@/lib/setup/storage";
import { parseChains, type ChainConfig } from "./chain";

/** Saves the approval chains: to the workspace database when one is connected, otherwise in this browser. */
export function saveChains(c: ChainConfig): void {
  writeSingle("chains", c);
}

/** The saved chains, with the industry's suggestion filling in any kind that was never set by hand. Empty on the server. */
export function useChains(): ChainConfig {
  const raw = useSingleRaw("chains");
  const setup = useSetupConfig();
  return useMemo(() => {
    const saved = parseChains(raw);
    const suggested = industryChains(setup);
    return { requests: saved.requests.length ? saved.requests : suggested.requests, forms: saved.forms.length ? saved.forms : suggested.forms };
  }, [raw, setup]);
}
