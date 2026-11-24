import { feedEvents, feedIcs } from "@/lib/calendar/feed";
import type { CalendarSources } from "@/lib/calendar/logic";
import { hashToken } from "@/lib/control/token";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_ROWS = 2000;
type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const gone = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });

// Saved records are plain JSON that a person (or an old version of the app) wrote: leave out one that lacks the shape the calendar needs,
// so a single bad record can never stop the whole calendar.
const good = {
  invoices: (d: Record<string, unknown>) => typeof d.number === "string" && typeof d.client === "string" && isDay(d.dueOn) && typeof d.status === "string",
  licenses: (d: Record<string, unknown>) => typeof d.name === "string" && isDay(d.expiresOn) && (d.reminderDays === undefined || (Array.isArray(d.reminderDays) && d.reminderDays.every((n) => Number.isInteger(n)))),
  projects: (d: Record<string, unknown>) => typeof d.name === "string" && Array.isArray(d.tasks) && d.tasks.every(isObj) && (d.milestones === undefined || (Array.isArray(d.milestones) && d.milestones.every(isObj))),
  vendors: (d: Record<string, unknown>) => typeof d.name === "string" && Array.isArray(d.documents) && d.documents.every(isObj),
  equipment: (d: Record<string, unknown>) => typeof d.name === "string" && typeof d.status === "string",
  reminders: (d: Record<string, unknown>) => typeof d.text === "string" && isDay(d.on) && typeof d.href === "string",
} as const;

/**
 * The private calendar feed: a calendar app subscribes to this address and shows the workspace's due dates, expiries and tasks.
 * The address holds a secret that only its SHA-256 hash is kept for, so there is no sign-in here: knowing the address is the access,
 * like the "secret address" other calendars give out. It answers 404 for anything that is not a live link (so nothing about a wrong
 * guess is revealed), and for a workspace whose account is suspended or cancelled. Read only.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/calendar/feed/[token]">) {
  const raw = (await ctx.params).token;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return gone();
  const admin = createServiceSupabase();
  if (!admin) return new Response("Not available", { status: 503, headers: { "cache-control": "no-store" } });
  try {
    const { data: feed } = await admin.from("calendar_feeds").select("workspace_id").eq("token_hash", hashToken(token)).maybeSingle();
    if (!feed) return gone();
    const ws = String(feed.workspace_id);
    const { data: client } = await admin.from("clients").select("status").eq("workspace_id", ws).maybeSingle();
    if (client && client.status !== "trial" && client.status !== "active") return gone();

    const load = async <K extends keyof typeof good>(kind: K): Promise<(Record<string, unknown> & { id: string })[]> => {
      const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", ws).eq("kind", kind).limit(MAX_ROWS);
      return ((data ?? []) as Row[]).filter((r) => isObj(r.data) && good[kind](r.data)).map((r) => ({ ...r.data, id: r.id }));
    };
    const [invoices, licenses, projects, vendors, equipment, reminders, workspace, docs] = await Promise.all([
      load("invoices"), load("licenses"), load("projects"), load("vendors"), load("equipment"), load("reminders"),
      admin.from("workspaces").select("name").eq("id", ws).maybeSingle(),
      admin.from("documents").select("id, display_name, expires_at").eq("workspace_id", ws).eq("status", "ready").is("deleted_at", null).not("expires_at", "is", null).limit(MAX_ROWS),
    ]);
    const src = {
      invoices, licenses, projects, vendors, equipment, reminders,
      documents: ((docs.data ?? []) as { id: string; display_name: string; expires_at: string }[]).filter((d) => isDay(String(d.expires_at).slice(0, 10))).map((d) => ({ id: d.id, name: d.display_name, expiresOn: String(d.expires_at).slice(0, 10) })),
    } as unknown as CalendarSources;
    const today = new Date().toISOString().slice(0, 10);
    const body = feedIcs(feedEvents(src, today), { name: String(workspace.data?.name ?? ""), today, origin: siteOrigin(req.url) });
    return new Response(body, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="adflo-calendar.ics"',
        "cache-control": "private, max-age=900",
        "x-robots-tag": "noindex",
        "referrer-policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Could not build the calendar", { status: 500, headers: { "cache-control": "no-store" } });
  }
}
