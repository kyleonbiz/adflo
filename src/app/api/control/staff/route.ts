import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { parseStaffInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

/** Owner adds a teammate (or re-activates one) by email. They must have signed up already. */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase }) => {
    const parsed = parseStaffInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const { email, role, name } = parsed.value;
    const { error } = await supabase.rpc("control_add_staff", { p_email: email, p_role: role, p_name: name });
    if (error) {
      if (error.code === "P0002") return fail(404, "no_account", "No account with that email yet. They need to sign up first.");
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  }, "owner");
}
