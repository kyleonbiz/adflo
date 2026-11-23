import { limitsFor } from "@/lib/control/tiers";
import { myUsage, recordUsage } from "@/lib/control/usage-server";
import { json, sameOrigin } from "@/lib/dms/server/respond";

export const dynamic = "force-dynamic";

/** Counts one quick (rules-based) assistant action. Informational only: quick actions are never limited. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: { code: "forbidden", message: "Cross-origin request blocked." } }, 403);
  await recordUsage({ quickActions: 1 });
  return json({ ok: true, data: null });
}

/** The signed-in workspace's usage this month against its plan's limits, for the Plans & limits panel in the app. */
export async function GET() {
  const u = await myUsage();
  if (!u) return json({ ok: false, error: { code: "unavailable", message: "Usage is not available." } }, 404);
  const l = u.plan ? limitsFor(u.plan) : null;
  return json({ ok: true, data: { ...u, limits: l ? { aiActions: l.aiActions, ocrPerMonth: l.ocrPerMonth, tokenBackstop: l.tokenBackstop } : null } });
}
