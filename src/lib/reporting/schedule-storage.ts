import { useMemo } from "react";
import { useRecordsRaw, writeRecords } from "@/lib/records/storage";
import { parseSchedules, type ScheduledReport } from "./schedule";

/** Saves the scheduled reports: to the workspace database when one is connected, otherwise in this browser. */
export function saveSchedules(list: ScheduledReport[]): void {
  writeRecords("schedules", list);
}

/** The saved schedules, kept in step across tabs. Empty on the server. */
export function useSchedules(): ScheduledReport[] {
  const raw = useRecordsRaw("schedules");
  return useMemo(() => parseSchedules(raw), [raw]);
}
