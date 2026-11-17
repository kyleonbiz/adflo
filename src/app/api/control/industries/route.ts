import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { loadLiveIndustries } from "@/lib/setup/live-server";
import { toggleError } from "@/lib/setup/types";

export const dynamic = "force-dynamic";

/** Owner only: open or close one industry to new sign-ups. Accounts already on it are not touched. */
export function PUT(req: Request) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const body = (await req.json().catch(() => null)) as { industry?: unknown; live?: unknown } | null;
    if (!body || typeof body.industry !== "string" || typeof body.live !== "boolean") return fail(400, "invalid", "Send an industry and whether it is open.");
    const current = await loadLiveIndustries(supabase);
    const problem = toggleError(current, body.industry, body.live);
    if (problem) return fail(409, "not_allowed", problem);
    const { error } = await supabase.from("live_industries").upsert({ industry: body.industry, live: body.live, updated_by: staff.userId, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true, data: { live: await loadLiveIndustries(supabase) } });
  }, "owner");
}
