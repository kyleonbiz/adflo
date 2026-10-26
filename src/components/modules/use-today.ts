import { useSyncExternalStore } from "react";
import { todayLocal } from "@/lib/dates";

const subscribe = () => () => {};

/**
 * The local calendar day. Server rendering has no browser clock, so it returns `initial` (null unless
 * the server knows the visitor's day); once in the browser the real local day takes over.
 */
export function useToday(initial: string | null = null): string | null {
  return useSyncExternalStore(subscribe, () => todayLocal(), () => initial);
}
