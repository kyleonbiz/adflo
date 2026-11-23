import type { SetupConfig } from "@/lib/setup/types";
import type { Link } from "./engine";
import { DRAFT_SERVICES, MAX_DRAFTS_PER_TURN, buildDraft } from "./guardrails";
import { PROPOSABLE, buildProposal, type Proposal } from "./proposal";

/** What the model may do: propose changes for the owner to approve, and prepare drafts. It cannot save anything or change the account setup. Status and how-to answers come from the rules engine, not from here. */
export const TOOL_DEFS = [
  {
    name: "propose_action",
    description: "Propose adding a contact, a vendor or a draft invoice. Nothing is saved: the owner sees a card in plain words and presses Approve, Reject or Edit, and only Approve saves it. Use only details the owner gave you; ask for anything required that is missing (contact: name; vendor: name and email; invoice: client and amount). Fields outside the service's list are dropped.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", enum: PROPOSABLE },
        fields: { type: "object", additionalProperties: { type: "string" }, description: "Field names and values, for example client, clientEmail, description, amount, dueOn for an invoice." },
      },
      required: ["service", "fields"],
      additionalProperties: false,
    },
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

export interface ToolState { readonly config: SetupConfig; today: string; links: Link[]; drafts?: number; proposals?: Proposal[]; now?: number }

const ok = (v: unknown) => JSON.stringify(v);
const err = (message: string) => JSON.stringify({ error: message });

export function runTool(state: ToolState, name: string, input: unknown): string {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (name) {
    case "propose_action": {
      if ((state.proposals?.length ?? 0) >= MAX_DRAFTS_PER_TURN) return err(`I can propose at most ${MAX_DRAFTS_PER_TURN} things at a time. Ask the owner to review these first.`);
      const result = buildProposal(String(args.service ?? ""), args.fields, state.now ?? Date.now(), `p-${Math.random().toString(36).slice(2, 10)}`);
      if (!result.ok) return err(result.error);
      state.proposals = [...(state.proposals ?? []), result.proposal];
      return ok({ proposed: result.proposal.title, note: "Nothing is saved. Tell the owner to check the card and press Approve, Reject or Edit." });
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
