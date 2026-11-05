/**
 * An approval chain is an ordered list of approvers. Each one signs off in turn; the item is approved
 * only after the last, and a decline at any step stops it there.
 */
export interface ApprovalEntry {
  by: string;
  on: string;
  decision: "approved" | "declined";
  comment: string;
}

export interface ApprovalProgress {
  /** The approvers, in order. */
  steps: string[];
  /** Decisions made so far, oldest first. */
  log: ApprovalEntry[];
}

export const MAX_STEPS = 6;
export const MAX_NAME = 60;

/** The kinds of thing a chain can be set for. */
export const CHAIN_KINDS = [
  { id: "requests", label: "Requests", fallback: "Operations manager", blurb: "Requests that trip an approval rule (spending, access, contracts)." },
  { id: "forms", label: "Forms", blurb: "Submissions of forms marked as needing approval. Leave empty to use each form's own approver.", fallback: "" },
] as const;
export type ChainKind = (typeof CHAIN_KINDS)[number]["id"];
export type ChainConfig = Record<ChainKind, string[]>;

export const emptyChains = (): ChainConfig => ({ requests: [], forms: [] });

/** Names trimmed, blanks and repeats dropped, capped. */
export function cleanSteps(steps: string[]): string[] {
  const out: string[] = [];
  for (const raw of steps) {
    const name = raw.trim().slice(0, MAX_NAME);
    if (name && !out.some((n) => n.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out.slice(0, MAX_STEPS);
}

/** Starts an item at its first step. With no steps, it uses the single `fallback` approver (or none). */
export function startProgress(steps: string[], fallback = ""): ApprovalProgress {
  const clean = cleanSteps(steps);
  return { steps: clean.length > 0 ? clean : fallback ? [fallback] : [], log: [] };
}

export const stepIndex = (p: ApprovalProgress) => p.log.filter((e) => e.decision === "approved").length;

/** Who must decide next, or null once the chain is finished. */
export function currentApprover(p: ApprovalProgress): string | null {
  if (p.log.some((e) => e.decision === "declined")) return null;
  return p.steps[stepIndex(p)] ?? null;
}

export type Outcome = "pending" | "approved" | "declined";

/** Records the current approver's decision. Returns the new progress and whether the whole chain is now settled. */
export function advance(p: ApprovalProgress, decision: "approved" | "declined", today: string, comment = ""): { progress: ApprovalProgress; outcome: Outcome } {
  const by = currentApprover(p);
  if (by === null) return { progress: p, outcome: p.log.some((e) => e.decision === "declined") ? "declined" : "approved" };
  const progress = { ...p, log: [...p.log, { by, on: today, decision, comment: comment.trim().slice(0, 300) }] };
  if (decision === "declined") return { progress, outcome: "declined" };
  return { progress, outcome: stepIndex(progress) >= progress.steps.length ? "approved" : "pending" };
}

export function describeProgress(p: ApprovalProgress): string {
  const by = currentApprover(p);
  return by === null ? "" : p.steps.length > 1 ? `Step ${stepIndex(p) + 1} of ${p.steps.length}: waiting on ${by}` : `Waiting on ${by}`;
}

export function parseChains(raw: string): ChainConfig {
  const base = emptyChains();
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return base;
    for (const k of CHAIN_KINDS) {
      const v = data[k.id];
      if (Array.isArray(v)) base[k.id] = cleanSteps(v.filter((x): x is string => typeof x === "string"));
    }
  } catch { /* keep the empty chains */ }
  return base;
}
