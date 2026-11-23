import { ADD_ONS, limitsFor } from "./tiers";

/** This month's counters for one workspace (UTC month). */
export interface Usage { aiActions: number; tokens: number; ocrReads: number; quickActions: number }
export const NO_USAGE: Usage = { aiActions: 0, tokens: 0, ocrReads: 0, quickActions: 0 };

export type Metered = "ai" | "ocr";
export type Verdict = { ok: true } | { ok: false; code: "limit_reached"; message: string };

const addOnLine = (plan: string) =>
  plan.trim().toLowerCase() === "enterprise"
    ? "Email support@adflo.pro or contact your account manager to raise it."
    : `Email support@adflo.pro to add ${ADD_ONS[2].label.toLowerCase()} for $${ADD_ONS[2].priceCents / 100}, or wait for next month.`;

/**
 * Whether one more Claude action or OCR read is allowed this month. A plan with no limits (a retired or legacy plan,
 * or no client record) is never limited, so nobody is cut off by accident. Quick actions are never limited.
 */
export function checkLimit(plan: string | null | undefined, usage: Usage, kind: Metered): Verdict {
  const limits = plan ? limitsFor(plan) : null;
  if (!plan || !limits) return { ok: true };
  if (kind === "ai") {
    if (usage.aiActions >= limits.aiActions)
      return { ok: false, code: "limit_reached", message: `You have used all ${limits.aiActions} Claude actions included this month. The built-in quick actions still work. ${addOnLine(plan)}` };
    if (limits.tokenBackstop != null && usage.tokens >= limits.tokenBackstop)
      return { ok: false, code: "limit_reached", message: `You have reached this month's Claude usage limit. The built-in quick actions still work. ${addOnLine(plan)}` };
    return { ok: true };
  }
  if (usage.ocrReads >= limits.ocrPerMonth)
    return { ok: false, code: "limit_reached", message: `You have used all ${limits.ocrPerMonth} photo reads included this month. Upload a PDF, Word, text or CSV file or enter the details by hand. ${addOnLine(plan)}` };
  return { ok: true };
}
