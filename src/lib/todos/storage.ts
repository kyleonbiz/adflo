import { useMemo } from "react";
import { useRecordsRaw, writeRecords } from "@/lib/records/storage";
import { parseTodos, type Todo } from "./logic";

/** Saves the to-do list: to the workspace database when one is connected, otherwise in this browser. */
export function saveTodos(todos: Todo[]): void {
  writeRecords("todos", todos);
}

/** The saved to-do list, kept in step across tabs and components. Empty on the server. */
export function useTodos(): Todo[] {
  const raw = useRecordsRaw("todos");
  return useMemo(() => parseTodos(raw), [raw]);
}
