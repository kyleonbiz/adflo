"use client";
import { useEffect } from "react";

/** One value from the address bar, or the fallback when it is missing or not one of `allowed`. Safe to call on the server (returns the fallback). */
export function readParam<T extends string>(key: string, fallback: T, allowed?: readonly string[]): T {
  if (typeof window === "undefined") return fallback;
  const v = new URLSearchParams(window.location.search).get(key);
  if (v === null || v === "") return fallback;
  if (allowed && !allowed.includes(v)) return fallback;
  return v as T;
}

/** Keeps filter values in the address bar (replacing the history entry), leaving out any that match their default, so a filtered list can be bookmarked or shared. Other parameters are kept. */
export function useUrlFilters(values: Record<string, string>, defaults: Record<string, string>): void {
  const signature = JSON.stringify(values);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(values)) {
      if (v === (defaults[k] ?? "") || v.trim() === "") p.delete(k);
      else p.set(k, v.trim());
    }
    const qs = p.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
