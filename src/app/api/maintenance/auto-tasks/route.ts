import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { AUTO_PROJECT_ID, followUps, withNewTasks, type AutoSources } from "@/lib/projects/auto-tasks";
import type { Project } from "@/lib/projects/types";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX_ROWS = 2000;
type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const strs = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

// Saved records are plain JSON that a person (or an old version of the app) wrote: skip one that lacks the shape this needs.
const good: Record<string, (d: Record<string, unknown>) => boolean> = {
  licenses: (d) => typeof d.name === "string" && isDay(d.expiresOn) && typeof d.stage === "string" && Array.isArray(d.reminderDays) && d.reminderDays.every((n) => Number.isInteger(n)),
  invoices: (d) => typeof d.number === "string" && typeof d.client === "string" && isDay(d.dueOn) && typeof d.status === "string",
  vendors: (d) => typeof d.name === "string" && typeof d.status === "string" && Array.isArray(d.documents) && d.documents.every(isObj) && (d.activity === undefined || (Array.isArray(d.activity) && d.activity.every(isObj))),
  equipment: (d) => typeof d.name === "string" && typeof d.status === "string",
  packets: (d) => typeof d.recipient === "string" && typeof d.templateName === "string" && Array.isArray(d.items) && d.items.every(isObj) && (d.remindedOn === undefined || strs(d.remindedOn)),
};
const isProject = (d: Record<string, unknown>) => typeof d.name === "string" && Array.isArray(d.tasks) && d.tasks.every(isObj) && (d.autoCreated === undefined || strs(d.autoCreated));

/**
 * Daily job (Vercel Cron). For each workspace that has switched on "Add follow-up tasks" in Settings (off until then), adds a task to
 * its "Renewals and follow-ups" project when: a license or policy enters its renewal window, equipment service or inspection is two
 * weeks away, a sent invoice is two weeks late, or a vendor or onboarding packet has gone quiet. A task is added once per situation:
 * the project keeps a list of what it has already added, so finishing or deleting a task never brings it back. Nobody is emailed.
 * Suspended and cancelled clients are skipped. Protected by CRON_SECRET. `?dry=1` counts and changes nothing.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const today = new Date().toISOString().slice(0, 10);
  const { data: clients, error } = await admin.from("clients").select("workspace_id").in("status", ["trial", "active"]).not("workspace_id", "is", null);
  if (error) { await recordJobRun("auto-tasks", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let on = 0, added = 0, failed = 0;
  for (const c of (clients ?? []) as { workspace_id: string }[]) {
    try {
      const ws = c.workspace_id;
      const load = async (kind: string): Promise<Row[]> => {
        const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", ws).eq("kind", kind).limit(MAX_ROWS);
        return ((data ?? []) as Row[]).filter((r) => isObj(r.data));
      };
      const settings = (await load("settings"))[0]?.data;
      const auto = isObj(settings?.automation) ? (settings!.automation as Record<string, unknown>) : {};
      if (auto.autoTasks !== true) continue;
      on++;

      const pick = async <T,>(kind: string): Promise<T[]> => (await load(kind)).filter((r) => good[kind](r.data)).map((r) => ({ ...r.data, id: r.id }) as unknown as T);
      const src: AutoSources = {
        licenses: await pick("licenses"), invoices: await pick("invoices"), vendors: await pick("vendors"), equipment: await pick("equipment"), packets: await pick("packets"),
      };
      const row = (await load("projects")).find((r) => r.id === AUTO_PROJECT_ID);
      if (row && !isProject(row.data)) { failed++; continue; } // never overwrite something we cannot read
      const existing = row ? ({ ...row.data, id: row.id } as unknown as Project) : null;
      const result = withNewTasks(existing, followUps(src, today), today);
      if (!result) continue;
      if (dry) { added += result.added.length; continue; }
      const { id, ...data } = result.project;
      const now = new Date().toISOString();
      const save = row
        ? await admin.from("workspace_records").update({ data, updated_at: now }).eq("workspace_id", ws).eq("kind", "projects").eq("id", id)
        : await admin.from("workspace_records").insert({ workspace_id: ws, kind: "projects", id, data, updated_at: now });
      if (save.error) failed++; else added += result.added.length;
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("auto-tasks", failed === 0, `${added} task${added === 1 ? "" : "s"} added, ${failed} failed, ${on} workspace${on === 1 ? "" : "s"} on`);
  return reply({ ok: true, dry, workspacesOn: on, added, failed }, 200);
}

export const GET = run;
export const POST = run;
