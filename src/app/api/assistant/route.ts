import { assistantConfigured, runAssistant, type ChatMessage } from "@/lib/assistant/llm";
import { getDms } from "@/lib/dms/server/context";
import { checkRate } from "@/lib/dms/server/rate-limit";
import { json, readJson, sameOrigin } from "@/lib/dms/server/respond";
import { toDmsError } from "@/lib/dms/errors";
import { sanitizeConfig } from "@/lib/setup/logic";
import { emptyConfig } from "@/lib/setup/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

function parseMessages(v: unknown): ChatMessage[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: ChatMessage[] = [];
  for (const m of v.slice(-MAX_MESSAGES)) {
    const r = m as Record<string, unknown>;
    if ((r?.role !== "user" && r?.role !== "assistant") || typeof r.content !== "string" || !r.content.trim()) return null;
    out.push({ role: r.role, content: r.content.slice(0, MAX_CHARS) });
  }
  // The API needs the conversation to start with, and end on, the user.
  while (out.length && out[0].role !== "user") out.shift();
  return out.length && out[out.length - 1].role === "user" ? out : null;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: { code: "forbidden", message: "Cross-origin request blocked." } }, 403);
  // Without a key the page keeps using its built-in rules, so say so plainly instead of failing.
  if (!assistantConfigured()) return json({ ok: false, error: { code: "not_configured", message: "The AI model is not connected." } }, 501);
  try {
    const dms = await getDms();
    const rate = checkRate(dms.userId, { name: "assistant", max: 20, windowMs: 60_000 });
    if (!rate.ok) return json({ ok: false, error: { code: "rate_limited", message: "Too many messages. Please wait a moment." } }, 429, { "retry-after": String(rate.retryAfterSec) });

    const body = (await readJson(req)) as Record<string, unknown>;
    const messages = parseMessages(body.messages);
    if (!messages) return json({ ok: false, error: { code: "invalid", message: "Send a conversation that ends with your message." } }, 400);
    const config = sanitizeConfig(body.config) ?? emptyConfig();
    const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);

    const result = await runAssistant(messages, config, today);
    return json({ ok: true, data: { ...result, config: sanitizeConfig(result.config) ?? config } });
  } catch (e) {
    const err = toDmsError(e);
    // Log the class only: messages can echo what the owner typed.
    if (err.code === "internal") console.error("[assistant] failed:", e instanceof Error ? e.name : typeof e);
    return json({ ok: false, error: { code: err.code, message: err.code === "internal" ? "The assistant could not answer right now." : err.message } }, err.status);
  }
}
