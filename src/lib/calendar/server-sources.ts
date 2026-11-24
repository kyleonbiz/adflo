import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarSources } from "./logic";

const MAX_ROWS = 2000;
type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Saved records are plain JSON that a person (or an old version of the app) wrote: leave out one that lacks the shape the calendar
// needs, so a single bad record can never stop the whole calendar.
const good = {
  invoices: (d: Record<string, unknown>) => typeof d.number === "string" && typeof d.client === "string" && isDay(d.dueOn) && typeof d.status === "string",
  licenses: (d: Record<string, unknown>) => typeof d.name === "string" && isDay(d.expiresOn) && (d.reminderDays === undefined || (Array.isArray(d.reminderDays) && d.reminderDays.every((n) => Number.isInteger(n)))),
  projects: (d: Record<string, unknown>) => typeof d.name === "string" && Array.isArray(d.tasks) && d.tasks.every(isObj) && (d.milestones === undefined || (Array.isArray(d.milestones) && d.milestones.every(isObj))),
  vendors: (d: Record<string, unknown>) => typeof d.name === "string" && Array.isArray(d.documents) && d.documents.every(isObj),
  equipment: (d: Record<string, unknown>) => typeof d.name === "string" && typeof d.status === "string",
  reminders: (d: Record<string, unknown>) => typeof d.text === "string" && isDay(d.on) && typeof d.href === "string",
} as const;

/** A workspace's dated records, read with the service role and shape-checked, in the form the calendar logic takes. Server only. */
export async function loadCalendarSources(admin: SupabaseClient, ws: string): Promise<CalendarSources> {
  const load = async <K extends keyof typeof good>(kind: K): Promise<(Record<string, unknown> & { id: string })[]> => {
    const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", ws).eq("kind", kind).limit(MAX_ROWS);
    return ((data ?? []) as Row[]).filter((r) => isObj(r.data) && good[kind](r.data)).map((r) => ({ ...r.data, id: r.id }));
  };
  const [invoices, licenses, projects, vendors, equipment, reminders, docs] = await Promise.all([
    load("invoices"), load("licenses"), load("projects"), load("vendors"), load("equipment"), load("reminders"),
    admin.from("documents").select("id, display_name, expires_at").eq("workspace_id", ws).eq("status", "ready").is("deleted_at", null).not("expires_at", "is", null).limit(MAX_ROWS),
  ]);
  return {
    invoices, licenses, projects, vendors, equipment, reminders,
    documents: ((docs.data ?? []) as { id: string; display_name: string; expires_at: string }[]).filter((d) => isDay(String(d.expires_at).slice(0, 10))).map((d) => ({ id: d.id, name: d.display_name, expiresOn: String(d.expires_at).slice(0, 10) })),
  } as unknown as CalendarSources;
}
