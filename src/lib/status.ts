import { getSupabaseEnv } from "@/lib/supabase/env";

export type ServiceLevel = "operational" | "degraded" | "down";
export interface ServiceStatus { name: string; level: ServiceLevel; detail: string }
export interface StatusReport { level: ServiceLevel; checkedAt: string; services: ServiceStatus[] }

const SLOW_MS = 1500;
const TIMEOUT_MS = 5000;

/** The worst level wins; an empty list counts as operational. */
export function overallLevel(services: Pick<ServiceStatus, "level">[]): ServiceLevel {
  if (services.some((s) => s.level === "down")) return "down";
  if (services.some((s) => s.level === "degraded")) return "degraded";
  return "operational";
}

/** Turns one probe result into a public-safe status. Never includes URLs, keys or error text from the provider. */
export function classifyProbe(name: string, ok: boolean, ms: number): ServiceStatus {
  if (!ok) return { name, level: "down", detail: "Not responding." };
  if (ms > SLOW_MS) return { name, level: "degraded", detail: "Responding slowly." };
  return { name, level: "operational", detail: "Operating normally." };
}

async function probeDatabase(): Promise<ServiceStatus> {
  const env = getSupabaseEnv();
  // No database configured (preview or development): nothing to report as down.
  if (!env) return { name: "Sign-in and database", level: "operational", detail: "Preview mode." };
  const t0 = Date.now();
  try {
    const res = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return classifyProbe("Sign-in and database", res.ok, Date.now() - t0);
  } catch {
    return classifyProbe("Sign-in and database", false, Date.now() - t0);
  }
}

/** Public status: the app answering at all, plus the sign-in and database service it depends on. */
export async function getStatusReport(): Promise<StatusReport> {
  const services: ServiceStatus[] = [
    { name: "AdFlo app", level: "operational", detail: "Operating normally." },
    await probeDatabase(),
  ];
  return { level: overallLevel(services), checkedAt: new Date().toISOString(), services };
}
