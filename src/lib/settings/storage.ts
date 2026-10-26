import { useMemo, useSyncExternalStore } from "react";
import { LEAD_DAYS, NOTIFICATION_KEYS, TIMEZONES, defaultSettings, type AppSettings } from "./types";

export const SETTINGS_KEY = "adflo.settings.v1";
const EVENT = "adflo-settings-change";

function read(): string {
  try { return window.localStorage.getItem(SETTINGS_KEY) ?? ""; } catch { return ""; }
}

/** Saved settings, with anything unknown, oversized or of the wrong type replaced by the default. */
export function parseSettings(raw: string): AppSettings {
  const base = defaultSettings();
  if (!raw) return base;
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    if (!r || typeof r !== "object" || r.version !== 1) return base;
    const d = (r.details ?? {}) as Record<string, unknown>;
    const n = (r.notifications ?? {}) as Record<string, unknown>;
    const en = (n.enabled ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.slice(0, max) : fallback);
    return {
      version: 1,
      details: {
        email: str(d.email, 120, ""),
        phone: str(d.phone, 40, ""),
        address: str(d.address, 200, ""),
        timezone: (TIMEZONES as readonly unknown[]).includes(d.timezone) ? (d.timezone as string) : base.details.timezone,
      },
      notifications: {
        enabled: Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, typeof en[k] === "boolean" ? en[k] : base.notifications.enabled[k]])) as AppSettings["notifications"]["enabled"],
        leadDays: (LEAD_DAYS as readonly unknown[]).includes(n.leadDays) ? (n.leadDays as AppSettings["notifications"]["leadDays"]) : base.notifications.leadDays,
      },
    };
  } catch { return base; }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage blocked: the change applies until the page is closed */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

export function useSettings(): AppSettings {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseSettings(raw), [raw]);
}
