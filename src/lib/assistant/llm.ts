import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { MODULES } from "@/lib/modules/registry";
import { AVAILABLE_MODULE_IDS } from "@/lib/setup/logic";
import type { SetupConfig } from "@/lib/setup/types";
import type { Link } from "./engine";
import { TOOL_DEFS, runTool, type ToolState } from "./tools";

export interface ChatMessage { role: "user" | "assistant"; content: string }
export interface LlmResult { text: string; config: SetupConfig; links: Link[] }

export const assistantConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5-5";
const MAX_STEPS = 6;

const SERVICES = MODULES.filter((m) => AVAILABLE_MODULE_IDS.includes(m.id)).map((m) => `- ${m.name}: ${m.summary}`).join("\n");

const SYSTEM = `You are the AdFlo assistant. AdFlo is a back-office tool for small businesses; its owners are not technical.

Your job is to help the owner set AdFlo up: learn about the business, suggest the services that fit, and deploy them (turning services on and installing their starter templates). You can also explain what each service does and say what is left to do.

AdFlo services:
${SERVICES}

Rules:
- Use the tools to read or change anything about the setup. Never say you saved, turned on or installed something unless a tool result confirms it.
- Ask for the business name, industry and team size before recommending; the tools only accept the listed industries and team sizes, so map the owner's words to the closest option and say which one you chose.
- Get a clear yes before calling deploy_services.
- You cannot import data, send email or edit records yourself; point the owner to the right service for that.
- Keep replies short and in plain language. No headings; short bullet lists are fine.`;

/** One assistant turn: lets the model call the setup tools until it has an answer. */
export async function runAssistant(messages: ChatMessage[], config: SetupConfig, today: string): Promise<LlmResult> {
  const client = new Anthropic();
  const state: ToolState = { config, today, links: [] };
  const convo: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low" },
      tools: TOOL_DEFS.map((t) => ({ ...t, input_schema: { ...t.input_schema } })) as Anthropic.Beta.BetaTool[],
      messages: convo,
    });

    if (res.stop_reason === "refusal") {
      return { text: "I can't help with that one. I can still help set up your business or explain the services.", config: state.config, links: state.links };
    }
    if (res.stop_reason !== "tool_use") {
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return { text: text || "Done.", config: state.config, links: state.links };
    }

    convo.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      results.push({ type: "tool_result", tool_use_id: block.id, content: runTool(state, block.name, block.input) });
    }
    convo.push({ role: "user", content: results });
  }
  return { text: "That took more steps than expected. Please try again.", config: state.config, links: state.links };
}
