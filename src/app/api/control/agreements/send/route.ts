import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { hashToken, newToken } from "@/lib/control/token";
import { parseSendInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

/**
 * Creates an acceptance link for a client. The link is returned once and only its hash is stored, so staff copy it into
 * their own email. (AdFlo does not send email itself yet.)
 */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase }) => {
    const parsed = parseSendInput(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.errors.templateId);
    const token = newToken();
    const { error } = await supabase.rpc("control_send_agreement", { p_client: parsed.value.clientId, p_template: parsed.value.templateId, p_token_hash: hashToken(token) });
    if (error) {
      if (error.code === "23503") return fail(404, "not_found", "Client or agreement not found.");
      throw error;
    }
    return NextResponse.json({ ok: true, link: `${new URL(req.url).origin}/agreement/${token}` }, { status: 201 });
  });
}
