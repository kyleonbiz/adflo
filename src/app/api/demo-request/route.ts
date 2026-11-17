import { NextResponse } from "next/server";
import { checkRate } from "@/lib/dms/server/rate-limit";
import { sameOrigin } from "@/lib/dms/server/respond";
import { demoRequestText, parseDemoRequest } from "@/lib/marketing/demo-request";

export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Public: the landing page "Book a demo" form. The server emails the request to DEMO_REQUEST_TO (default sales@adflo.pro) through
 * Resend, so the visitor never has to open an email app. Needs RESEND_API_KEY and a sender address on a domain verified in Resend.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply(403, { ok: false, error: "Cross-origin request blocked." });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!checkRate(ip, { name: "demo-request", max: 5, windowMs: 10 * 60_000 }).ok) return reply(429, { ok: false, error: "Too many requests. Please wait a few minutes and try again." });

  const raw = await req.json().catch(() => null);
  // Hidden field a person never fills in; bots do. Pretend it worked.
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).website) return reply(200, { ok: true });
  const parsed = parseDemoRequest(raw);
  if (!parsed.ok) return reply(400, { ok: false, error: "Check the highlighted fields.", fields: parsed.errors });

  const key = process.env.RESEND_API_KEY;
  if (!key) return reply(503, { ok: false, error: "Demo requests are not switched on yet." });
  const to = process.env.DEMO_REQUEST_TO || "sales@adflo.pro";
  const from = process.env.DEMO_REQUEST_FROM || "AdFlo <noreply@adflo.pro>";
  const d = parsed.value;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], reply_to: d.email, subject: `AdFlo demo request: ${d.company}`, text: demoRequestText(d) }),
  }).catch(() => null);
  if (!res || !res.ok) return reply(502, { ok: false, error: "We could not send your request. Please try again, or email us directly." });
  return reply(200, { ok: true });
}
