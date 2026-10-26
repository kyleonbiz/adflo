import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
const EVENT = "adflo-theme-change";

function read(): Theme {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch { return "system"; }
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch { /* storage blocked: the choice still applies until the page is closed */ }
  apply(theme);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => { if (read() === "system") apply("system"); onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onSystem);
  mq.addEventListener("change", onSystem);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onSystem); mq.removeEventListener("change", onSystem); };
}

/** The saved choice ("system" when none). "system" on the server. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "system");
}
