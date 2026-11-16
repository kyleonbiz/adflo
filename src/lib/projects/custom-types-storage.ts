import { useMemo } from "react";
import { useRecordsRaw, writeRecords } from "@/lib/records/storage";
import { parseCustomTypes } from "./custom-types";
import type { ProjectTemplate } from "./templates";

/** Saves the project types you added: to the workspace database when one is connected, otherwise in this browser. */
export function saveCustomTypes(list: ProjectTemplate[]): void {
  writeRecords("projecttypes", list);
}

/** The project types you added yourself. Empty on the server. */
export function useCustomTypes(): ProjectTemplate[] {
  const raw = useRecordsRaw("projecttypes");
  return useMemo(() => parseCustomTypes(raw), [raw]);
}
