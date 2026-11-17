import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { checkRate } from "@/lib/dms/server/rate-limit";
import { sameOrigin } from "@/lib/dms/server/respond";
import { demoRequestText, parseDemoRequest } from "@/lib/marketing/demo-request";

export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Public: the landing page "Book a demo" form. The server emails the request to DEMO_REQUEST_TO (default: the sending mailbox itself)
 * through the company's Google Workspace mailbox, so the visitor never has to open an email app.
 * Needs SMTP_USER (a Workspace address such as sales@adflo.pro or kyle@adflo.pro) and SMTP_PASSWORD (a Google app password).
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

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return reply(503, { ok: false, error: "Demo requests are not switched on yet." });
  const d = parsed.value;
  try {
    const mail = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    await mail.sendMail({
      from: process.env.DEMO_REQUEST_FROM || `AdFlo <${user}>`,
      to: process.env.DEMO_REQUEST_TO || user,
      replyTo: d.email,
      subject: `AdFlo demo request: ${d.company}`,
      text: demoRequestText(d),
    });
  } catch {
    return reply(502, { ok: false, error: "We could not send your request. Please try again in a moment." });
  }
  return reply(200, { ok: true });
}
