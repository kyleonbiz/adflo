import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { agreementDeleteError, agreementEditError } from "@/lib/control/agreements";
import { parseAgreementEdit } from "@/lib/control/validation";
import { isUuid } from "@/lib/control/patterns";

export const dynamic = "force-dynamic";

/** Owner edits one published version's text and effective date, until a client has accepted it. */
export function PATCH(req: Request, ctx: RouteContext<"/api/control/agreements/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "That agreement no longer exists.");
    const parsed = parseAgreementEdit(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const { error } = await supabase.rpc("control_edit_agreement", { p_template: id, p_body: parsed.value.body, p_effective: parsed.value.effectiveDate });
    if (error) {
      const e = agreementEditError(error.code, error.message);
      return fail(e.status, "agreement", e.message);
    }
    return NextResponse.json({ ok: true });
  }, "owner");
}

/** Owner deletes one published agreement version, unless a client has accepted it. Unaccepted links sent from it go with it. */
export function DELETE(req: Request, ctx: RouteContext<"/api/control/agreements/[id]">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "That agreement no longer exists.");
    const { data, error } = await supabase.rpc("control_delete_agreement", { p_template: id });
    if (error) {
      const e = agreementDeleteError(error.code, error.message);
      return fail(e.status, "agreement", e.message);
    }
    return NextResponse.json({ ok: true, linksRemoved: typeof data === "number" ? data : 0 });
  }, "owner");
}
