import { useSyncExternalStore } from "react";
import { todayLocal } from "@/lib/dates";

const subscribe = () => () => {};

/** The local calendar day, or null during server rendering so the first paint never mismatches. */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, () => todayLocal(), () => null);
}
