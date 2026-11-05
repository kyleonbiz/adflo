import { useMemo, useSyncExternalStore } from "react";

/** What a person sees in AdFlo. Owners see everything; Contributors only do field work. */
export const ROLES = ["owner", "admin", "contributor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { label: string; detail: string }> = {
  owner: { label: "Owner", detail: "Everything, including team settings." },
  admin: { label: "Admin", detail: "All services, but not team settings." },
  contributor: { label: "Contributor", detail: "Home, Projects and Documents only, so they can check tasks and upload files." },
};

/** Services each role can open. `undefined` means all of them. */
const MODULE_ACCESS: Record<Role, readonly string[] | undefined> = {
  owner: undefined,
  admin: undefined,
  contributor: ["overview", "documents", "projects"],
};

/** Settings tabs each role can open. `undefined` means all of them. */
const SETTINGS_ACCESS: Record<Role, readonly string[] | undefined> = {
  owner: undefined,
  admin: ["profile", "notifications", "invoice-checks", "setup"],
  contributor: [],
};

export const canOpenModule = (role: Role, moduleId: string): boolean => {
  if (moduleId === "assistant") return role !== "contributor";
  return MODULE_ACCESS[role]?.includes(moduleId) ?? true;
};

export const canOpenSettingsTab = (role: Role, tab: string): boolean => SETTINGS_ACCESS[role]?.includes(tab) ?? true;

/** Which service a path under /app belongs to, or null for a path that is not a service. */
export function moduleOfPath(pathname: string): string | null {
  const m = /^\/app(?:\/([^/?#]+))?/.exec(pathname);
  if (!m) return null;
  const slug = m[1];
  if (!slug) return "documents"; // /app is the Documents front page
  const SLUG_TO_ID: Record<string, string> = { contacts: "crm" };
  return SLUG_TO_ID[slug] ?? slug;
}

/** True when `role` may open `pathname`. Paths outside /app are not restricted here. */
export function canOpenPath(role: Role, pathname: string): boolean {
  const id = moduleOfPath(pathname);
  if (id === null) return true;
  if (id === "setup") return role !== "contributor";
  return canOpenModule(role, id);
}

export const VIEW_AS_KEY = "adflo.viewAs.v1";
const EVENT = "adflo-viewas-change";

function read(): string {
  try { return window.localStorage.getItem(VIEW_AS_KEY) ?? ""; } catch { return ""; }
}

export const parseRole = (raw: string): Role => (ROLES as readonly string[]).includes(raw) ? (raw as Role) : "owner";

export function setViewAs(role: Role): void {
  try { window.localStorage.setItem(VIEW_AS_KEY, role); } catch { /* storage blocked: applies until the page is closed */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/**
 * The role being previewed, saved in this browser. Until sign-in carries real roles this is how
 * you see AdFlo as each one. "owner" on the server and before the saved choice loads.
 */
export function useViewAs(): Role {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseRole(raw), [raw]);
}
