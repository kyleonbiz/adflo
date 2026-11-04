import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { parseAgreementInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

/** Owner publishes a new agreement, or a new version of an existing title. */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase }) => {
    const parsed = parseAgreementInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const { error } = await supabase.rpc("control_publish_agreement", { p_title: parsed.value.title, p_body: parsed.value.body });
    if (error) {
      if (error.code === "42501") return fail(403, "owner_only", "Only the Owner can publish agreements.");
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  }, "owner");
}
