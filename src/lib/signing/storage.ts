import { useMemo, useSyncExternalStore } from "react";
import type { SigningRequest } from "./logic";

const KEY = "adflo.signing.v1";
const EVENT = "adflo-signing-change";

const read = () => { try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function parseRequests(raw: string): SigningRequest[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((r): r is SigningRequest =>
      !!r && typeof r.id === "string" && typeof r.title === "string" && typeof r.hash === "string" && typeof r.text === "string" &&
      Array.isArray(r.signers) && r.signers.every((s: { id?: unknown; name?: unknown }) => typeof s?.id === "string" && typeof s?.name === "string"));
  } catch { return []; }
}

export function saveRequests(list: SigningRequest[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: requests last until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The signature requests saved in this browser. Empty on the server. */
export function useSigningRequests(): SigningRequest[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseRequests(raw), [raw]);
}
