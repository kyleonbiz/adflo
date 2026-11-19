import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { CLIENT_COLUMNS, toClient } from "@/lib/control/data";
import { findDuplicateClient } from "@/lib/control/duplicates";
import { emailWelcome } from "@/lib/control/welcome-email";
import { workspaceErrorMessage } from "@/lib/control/workspace";
import { parseClientInput } from "@/lib/control/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return staffRoute(req, async ({ supabase, staff }) => {
    const body = await req.json().catch(() => null);
    const parsed = parseClientInput(body);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Check the highlighted fields.", fields: parsed.errors } }, { status: 400 });
    const v = parsed.value;
    // Checked here first so the message says which existing client it clashes with; the database indexes are the backstop.
    const { data: existing } = await supabase.from("clients").select("id, name, owner_email");
    const dup = findDuplicateClient(existing ?? [], { name: v.name, ownerEmail: v.ownerEmail });
    if (dup) return NextResponse.json({ ok: false, error: { code: "duplicate", message: dup.message, fields: { [dup.field]: dup.message } } }, { status: 409 });
    const { data, error } = await supabase.from("clients").insert({
      name: v.name, status: v.status, plan: v.plan, seats_limit: v.seatsLimit,
      owner_name: v.ownerName, owner_email: v.ownerEmail, notes: v.notes, created_by: staff.userId,
      price_override_cents: v.priceOverrideCents ?? null, price_note: v.priceNote ?? "",
      started_on: new Date().toISOString().slice(0, 10),
    }).select(CLIENT_COLUMNS).single();
    if (error) {
      if (error.code === "42501") return fail(403, "owner_only", "Only the Owner can set a client's own price.");
      // 23505 = a client with that name exists (case-insensitive unique index).
      if (error.code === "23505") return fail(409, "duplicate", "A client with that name or owner email already exists.");
      throw error;
    }
    // One step for staff: the client and its workspace (with the owner invited) are made together. If the workspace
    // cannot be made the client is still saved, and the response says so; the Workspace card on the client finishes it.
    let workspaceError: string | null = null;
    let mail: { emailedTo?: string; emailError?: string } = {};
    let client = toClient(data);
    if (body?.createWorkspace === true) {
      const made = await supabase.rpc("control_provision_workspace", { p_client: data.id });
      if (made.error) workspaceError = workspaceErrorMessage(made.error.code, made.error.message).message;
      else {
        const { data: fresh } = await supabase.from("clients").select(CLIENT_COLUMNS).eq("id", data.id).maybeSingle();
        if (fresh) client = toClient(fresh);
        // The invitation exists, so the owner is emailed it now. A failed email never undoes the client or the invitation.
        try {
          const r = await emailWelcome(supabase, staff.userId, data.id, req.url);
          mail = r.ok ? { emailedTo: r.emailedTo } : { emailError: r.message };
        } catch { mail = { emailError: "The invitation email could not be sent. Use Copy welcome message and send it yourself." }; }
      }
    }
    return NextResponse.json({ ok: true, client, workspaceError, ...mail }, { status: 201 });
  });
}
