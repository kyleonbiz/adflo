import { recordUsage } from "@/lib/control/usage-server";
import { json, sameOrigin } from "@/lib/dms/server/respond";

export const dynamic = "force-dynamic";

/** Counts one quick (rules-based) assistant action. Informational only: quick actions are never limited. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: { code: "forbidden", message: "Cross-origin request blocked." } }, 403);
  await recordUsage({ quickActions: 1 });
  return json({ ok: true, data: null });
}
