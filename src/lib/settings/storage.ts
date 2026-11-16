import { useMemo } from "react";
import { useSingleRaw, writeSingle } from "@/lib/records/storage";
import { LEAD_DAYS, NOTIFICATION_KEYS, TIMEZONES, defaultSettings, type AppSettings } from "./types";

/** Where the preview keeps the settings in this browser (the records layer uses it; with a database they are saved to the workspace). */
export const SETTINGS_KEY = "adflo.settings.v1";

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

/** Saves the settings: to the workspace database when one is connected, otherwise in this browser. */
export function saveSettings(settings: AppSettings): void {
  writeSingle("settings", settings);
}

export function useSettings(): AppSettings {
  const raw = useSingleRaw("settings");
  return useMemo(() => parseSettings(raw), [raw]);
}
