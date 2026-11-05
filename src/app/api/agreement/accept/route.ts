import { NextResponse } from "next/server";
import { checkRate } from "@/lib/dms/server/rate-limit";
import { sameOrigin } from "@/lib/dms/server/respond";
import { fakeAgreementAccept, fakeAgreementReset, isFakeAgreement } from "@/lib/control/fake-agreement";
import { parseAcceptInput } from "@/lib/control/validation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bad = (status: number, message: string, fields?: Record<string, string>) => NextResponse.json({ ok: false, error: { message, fields } }, { status, headers: { "cache-control": "no-store" } });

/** Public: a client accepts the agreement at their link. The database allows it once, before the link expires. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad(403, "Cross-origin request blocked.");
  const raw = getSupabaseEnv() ? null : await req.json().catch(() => null);
  if (!getSupabaseEnv()) {
    // Test-only fake agreement (see fake-agreement.ts); everything else is unavailable without a database.
    if (!isFakeAgreement(raw?.token)) return bad(503, "Not available right now.");
    if (raw.reset === true) { fakeAgreementReset(); return NextResponse.json({ ok: true }); }
    const fake = parseAcceptInput(raw);
    if (!fake.ok) return bad(400, "Check the highlighted fields.", fake.errors);
    return fakeAgreementAccept(fake.value.name) ? NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } }) : bad(409, "This link has expired or was already used. Ask AdFlo for a new one.");
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!checkRate(ip, { name: "agreement-accept", max: 10, windowMs: 10 * 60_000 }).ok) return bad(429, "Too many tries. Wait a few minutes and try again.");
  const parsed = parseAcceptInput(await req.json().catch(() => null));
  if (!parsed.ok) return bad(400, "Check the highlighted fields.", parsed.errors);
  const { token, name, email } = parsed.value;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("agreement_public_accept", { p_token: token, p_name: name, p_email: email });
  if (error) return bad(500, "Something went wrong. Try again.");
  if (!data) return bad(409, "This link has expired or was already used. Ask AdFlo for a new one.");
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
