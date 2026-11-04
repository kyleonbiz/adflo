import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/control/api";
import { parseTicketInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const parsed = parseTicketInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const v = parsed.value;
    const { data, error } = await supabase.from("support_tickets").insert({ subject: v.subject, body: v.body, client_id: v.clientId, priority: v.priority, created_by: staff.userId }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  });
}
