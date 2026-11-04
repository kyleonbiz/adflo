import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { CLIENT_COLUMNS, toClient } from "@/lib/control/data";
import { parseClientInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const body = await req.json().catch(() => null);
    const parsed = parseClientInput(body);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const v = parsed.value;
    const { data, error } = await supabase.from("clients").insert({
      name: v.name, status: v.status, plan: v.plan, seats_limit: v.seatsLimit,
      owner_name: v.ownerName, owner_email: v.ownerEmail, notes: v.notes, created_by: staff.userId,
      price_override_cents: v.priceOverrideCents ?? null, price_note: v.priceNote ?? "",
      started_on: new Date().toISOString().slice(0, 10),
    }).select(CLIENT_COLUMNS).single();
    if (error) {
      if (error.code === "42501") return fail(403, "owner_only", "Only the Owner can set a client's own price.");
      // 23505 = a client with that name exists (case-insensitive unique index).
      if (error.code === "23505") return fail(409, "duplicate", "A client with that name already exists.");
      throw error;
    }
    return NextResponse.json({ ok: true, client: toClient(data) }, { status: 201 });
  });
}
