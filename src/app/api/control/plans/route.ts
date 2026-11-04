import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { parsePlanInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return staffRoute(req, async ({ supabase }) => {
    const parsed = parsePlanInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const v = parsed.value;
    const { error } = await supabase.from("plans").insert({ name: v.name, price_cents: v.priceCents, seats_included: v.seatsIncluded });
    if (error) {
      if (error.code === "23505") return fail(409, "duplicate", "A plan with that name already exists.");
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  }, "owner");
}
