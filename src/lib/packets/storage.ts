import { useMemo } from "react";
import { useRecordsRaw, writeRecords } from "@/lib/records/storage";
import { parseAssignments, type Assignment } from "./logic";

/** Saves the packets handed out: to the workspace database when one is connected, otherwise in this browser. */
export function saveAssignments(list: Assignment[]): void {
  writeRecords("packets", list);
}

/** The packets handed out so far. Empty on the server. */
export function useAssignments(): Assignment[] {
  const raw = useRecordsRaw("packets");
  return useMemo(() => parseAssignments(raw), [raw]);
}
