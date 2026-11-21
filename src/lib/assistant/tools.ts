import { MODULES } from "@/lib/modules/registry";
import { AVAILABLE_MODULE_IDS, IMPORTABLE, runSetupChecks, setupScore } from "@/lib/setup/logic";
import type { SetupConfig } from "@/lib/setup/types";
import type { Link } from "./engine";
import { DRAFT_SERVICES, MAX_DRAFTS_PER_TURN, buildDraft } from "./guardrails";

/** What the model may do: read the saved setup and prepare drafts. It cannot change the account setup; the owner does that by hand in Settings. */
export const TOOL_DEFS = [
  {
    name: "list_services",
    description: "List every AdFlo service the business can turn on, with what each does.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_status",
    description: "Read-only: the business profile, chosen services, setup health score and every open check in Settings.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prepare_draft",
    description: "Prepare a draft in one service (invoice, request, contact, vendor, project or license record) as a link that opens that service's form with your details already in. Nothing is saved: the owner reviews the form and presses the save button. Use only details the owner gave you. Fields outside the service's list are dropped.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", enum: DRAFT_SERVICES.map((s) => s.id) },
        fields: { type: "object", additionalProperties: { type: "string" }, description: "Field names and values, for example client, clientEmail, amount, dueOn for an invoice." },
      },
      required: ["service", "fields"],
      additionalProperties: false,
    },
  },
] as const;

export interface ToolState { readonly config: SetupConfig; today: string; links: Link[]; drafts?: number }

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
    case "prepare_draft": {
      if ((state.drafts ?? 0) >= MAX_DRAFTS_PER_TURN) return err(`I can prepare at most ${MAX_DRAFTS_PER_TURN} drafts at a time. Ask the owner to review these first.`);
      const result = buildDraft(String(args.service ?? ""), args.fields);
      if (!result.ok) return err(result.error);
      state.drafts = (state.drafts ?? 0) + 1;
      state.links = [...state.links, { label: `Review ${result.service.noun}`, href: result.href }];
      return ok({
        prepared: result.service.noun,
        filled: result.used,
        ignored: result.dropped,
        note: "Nothing is saved yet. Tell the owner to open the link, check the form and press its save button.",
      });
    }
    default:
      return err(`Unknown tool ${name}.`);
  }
}
