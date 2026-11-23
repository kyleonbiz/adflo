import "server-only";
import { findMembership } from "@/lib/dms/server/context";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkLimit, NO_USAGE, type Metered, type Usage, type Verdict } from "./usage";

interface Ctx { supabase: Awaited<ReturnType<typeof createServerSupabase>>; workspaceId: string }

async function context(): Promise<Ctx | null> {
  if (!getSupabaseEnv()) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const membership = await findMembership(supabase, data.user.id);
  return membership ? { supabase, workspaceId: membership.workspaceId } : null;
}

const toUsage = (raw: unknown): Usage => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { aiActions: n(r.aiActions), tokens: n(r.tokens), ocrReads: n(r.ocrReads), quickActions: n(r.quickActions) };
};

/** Whether the signed-in workspace may use one more Claude action or OCR read this month. Allows whenever it cannot tell. */
export async function allowUsage(kind: Metered): Promise<Verdict> {
  try {
    const ctx = await context();
    if (!ctx) return { ok: true };
    const [plan, usage] = await Promise.all([
      ctx.supabase.rpc("workspace_plan", { p_workspace: ctx.workspaceId }),
      ctx.supabase.rpc("workspace_usage_now", { p_workspace: ctx.workspaceId }),
    ]);
    return checkLimit(typeof plan.data === "string" ? plan.data : null, toUsage(usage.data), kind);
  } catch {
    return { ok: true };
  }
}

/** Adds to this month's counters. Never throws: a failed count must not fail a request that was already served. */
export async function recordUsage(add: Partial<Usage>): Promise<void> {
  try {
    const ctx = await context();
    if (!ctx) return;
    const a = { ...NO_USAGE, ...add };
    await ctx.supabase.rpc("record_usage", {
      p_workspace: ctx.workspaceId, p_ai: a.aiActions, p_tokens: Math.min(Math.round(a.tokens), 1_000_000), p_ocr: a.ocrReads, p_quick: a.quickActions,
    });
  } catch {
    console.error("[usage] could not record");
  }
}
