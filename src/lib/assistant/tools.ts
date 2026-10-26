import { MODULES } from "@/lib/modules/registry";
import { AVAILABLE_MODULE_IDS, IMPORTABLE, recommendModules, runSetupChecks, setupScore } from "@/lib/setup/logic";
import { INDUSTRIES, TEAM_SIZES, type Industry, type SetupConfig, type TeamSize } from "@/lib/setup/types";
import { deploy, type Link } from "./engine";

/** What the model may do: read and change the same saved setup the Settings page edits. Nothing else. */
export const TOOL_DEFS = [
  {
    name: "list_services",
    description: "List every AdFlo service the business can turn on, with what each does.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_status",
    description: "Current setup: business profile, chosen services, setup health score and every open check.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_business_profile",
    description: "Save the business name, industry and team size. Send only what the user told you.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Business name, 2-80 characters." },
        industry: { type: "string", enum: [...INDUSTRIES] },
        team_size: { type: "string", enum: [...TEAM_SIZES] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "recommend_services",
    description: "Services that fit the saved industry and team size, with a reason each. Needs industry and team size saved first.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "deploy_services",
    description: "Turn services on and install their starter forms, recurring tasks and license records. Only call after the user agreed. With no module_ids it deploys the recommended set.",
    input_schema: {
      type: "object",
      properties: { module_ids: { type: "array", items: { type: "string", enum: AVAILABLE_MODULE_IDS } } },
      additionalProperties: false,
    },
  },
] as const;

export interface ToolState { config: SetupConfig; today: string; links: Link[] }

const nameOf = (id: string) => MODULES.find((m) => m.id === id)?.name ?? id;
const ok = (v: unknown) => JSON.stringify(v);
const err = (message: string) => JSON.stringify({ error: message });

export function runTool(state: ToolState, name: string, input: unknown): string {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const { config } = state;
  switch (name) {
    case "list_services":
      return ok(AVAILABLE_MODULE_IDS.map((id) => ({ id, name: nameOf(id), does: MODULES.find((m) => m.id === id)?.summary })));
    case "get_status": {
      const checks = runSetupChecks(config);
      return ok({
        business: config.business,
        services: config.modules.map(nameOf),
        deployed: config.completedOn !== null,
        score: setupScore(checks),
        open: checks.filter((c) => c.status !== "pass").map((c) => ({ title: c.title, status: c.status, detail: c.detail })),
        importHints: config.modules.filter((id) => IMPORTABLE[id] && !config.importsDone.includes(id)).map((id) => ({ service: nameOf(id), how: IMPORTABLE[id] })),
      });
    }
    case "set_business_profile": {
      const b = { ...config.business };
      if (typeof args.name === "string") {
        const n = args.name.trim();
        if (n.length < 2 || n.length > 80) return err("Business name must be 2-80 characters.");
        b.name = n;
      }
      if (args.industry !== undefined) {
        if (!(INDUSTRIES as readonly unknown[]).includes(args.industry)) return err("Unknown industry.");
        b.industry = args.industry as Industry;
      }
      if (args.team_size !== undefined) {
        if (!(TEAM_SIZES as readonly unknown[]).includes(args.team_size)) return err("Unknown team size.");
        b.teamSize = args.team_size as TeamSize;
      }
      state.config = { ...config, business: b };
      return ok({ saved: b });
    }
    case "recommend_services": {
      const { industry, teamSize } = config.business;
      if (!industry || !teamSize) return err("Save the industry and team size first.");
      return ok(recommendModules(industry, teamSize).filter((r) => AVAILABLE_MODULE_IDS.includes(r.id)).map((r) => ({ id: r.id, name: nameOf(r.id), reason: r.reason })));
    }
    case "deploy_services": {
      const { industry, teamSize, name: bizName } = config.business;
      if (bizName.trim().length < 2 || !industry || !teamSize) return err("Save the business name, industry and team size before deploying.");
      const asked = Array.isArray(args.module_ids) ? args.module_ids.filter((x): x is string => typeof x === "string" && AVAILABLE_MODULE_IDS.includes(x)) : [];
      const ids = asked.length > 0 ? [...new Set(asked)] : recommendModules(industry, teamSize).map((r) => r.id).filter((id) => AVAILABLE_MODULE_IDS.includes(id));
      const reply = deploy({ ...config, modules: ids, completedOn: null }, state.today);
      state.config = reply.config;
      state.links = reply.turns[0]?.links ?? [];
      return ok({ deployed: reply.config.completedOn !== null, services: ids.map(nameOf), templatesInstalled: reply.config.templates.length, summary: reply.turns[0]?.text });
    }
    default:
      return err(`Unknown tool ${name}.`);
  }
}
