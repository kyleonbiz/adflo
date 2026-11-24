import { feedEvents, feedIcs } from "@/lib/calendar/feed";
import { loadCalendarSources } from "@/lib/calendar/server-sources";
import { hashToken } from "@/lib/control/token";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const gone = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });

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

    const [src, workspace] = await Promise.all([loadCalendarSources(admin, ws), admin.from("workspaces").select("name").eq("id", ws).maybeSingle()]);
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
