import { useMemo } from "react";
import { useRecordsRaw, writeRecords } from "@/lib/records/storage";
import type { SigningRequest } from "./logic";

function parseRequests(raw: string): SigningRequest[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((r): r is SigningRequest =>
      !!r && typeof r.id === "string" && typeof r.title === "string" && typeof r.hash === "string" && typeof r.text === "string" &&
      Array.isArray(r.signers) && r.signers.every((s: { id?: unknown; name?: unknown }) => typeof s?.id === "string" && typeof s?.name === "string"));
  } catch { return []; }
}

/** Saves the signature requests: to the workspace database when one is connected, otherwise in this browser. */
export function saveRequests(list: SigningRequest[]): void {
  writeRecords("signing", list);
}

/** The saved signature requests. Empty on the server. */
export function useSigningRequests(): SigningRequest[] {
  const raw = useRecordsRaw("signing");
  return useMemo(() => parseRequests(raw), [raw]);
}
