import { useMemo } from "react";
import { useRecordsRaw, writeRecords } from "@/lib/records/storage";
import { parseReminders, type Reminder } from "./logic";

/** Saves the reminders: to the workspace database when one is connected, otherwise in this browser. */
export function saveReminders(list: Reminder[]): void {
  writeRecords("reminders", list);
}

/** Reminders set with "Remind me". Empty on the server. */
export function useReminders(): Reminder[] {
  const raw = useRecordsRaw("reminders");
  return useMemo(() => parseReminders(raw), [raw]);
}
