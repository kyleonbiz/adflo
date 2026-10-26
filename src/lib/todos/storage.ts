import { useMemo, useSyncExternalStore } from "react";
import { parseTodos, type Todo } from "./logic";

const KEY = "adflo.todos.v1";
const EVENT = "adflo-todos-change";

function read(): string {
  try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function saveTodos(todos: Todo[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(todos));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage unavailable: the list still works until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** The saved to-do list, kept in step across tabs and components. Empty on the server. */
export function useTodos(): Todo[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseTodos(raw), [raw]);
}
