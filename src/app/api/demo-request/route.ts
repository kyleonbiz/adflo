import { NextResponse } from "next/server";
import { checkRate } from "@/lib/dms/server/rate-limit";
import { sameOrigin } from "@/lib/dms/server/respond";
import { parseDemoRequest } from "@/lib/leads/validation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const reply = (status: number, body: object) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/** Public: the landing page's demo request form. The record is written by a database function that checks every field again. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply(403, { ok: false, error: { message: "Cross-origin request blocked." } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!checkRate(ip, { name: "demo-request", max: 5, windowMs: 10 * 60_000 }).ok) {
    return reply(429, { ok: false, error: { message: "Too many requests. Wait a few minutes and try again." } });
  }
  const raw = await req.json().catch(() => null);
  // A hidden field only bots fill in: pretend it worked and store nothing.
  if (raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).website === "string" && (raw as Record<string, string>).website) return reply(200, { ok: true });
  const parsed = parseDemoRequest(raw);
  if (!parsed.ok) return reply(400, { ok: false, error: { message: "Check the highlighted fields.", fields: parsed.errors } });
  if (!getSupabaseEnv()) return reply(503, { ok: false, error: { message: "Demo requests are not switched on for this site yet." } });
  const { name, email, company, size, message } = parsed.value;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("demo_request_submit", { p_name: name, p_email: email, p_company: company, p_size: size, p_message: message });
  if (error || data !== true) return reply(500, { ok: false, error: { message: "Something went wrong. Try again in a moment." } });
  return reply(200, { ok: true });
}
