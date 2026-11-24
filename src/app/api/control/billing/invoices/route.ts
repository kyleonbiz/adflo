import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { MAX_CHANGES, isBillingInvoice, toRow } from "@/lib/control/billing-db";

export const dynamic = "force-dynamic";

/**
 * Saves changes to AdFlo's own invoices: the ones added or edited, and the ones removed. The Owner and the Billing role only (the
 * database enforces it too). Each invoice is its own row, so two people editing different invoices never overwrite each other.
 */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase, staff }) => {
    if (staff.role === "support") return fail(403, "read_only", "Your role can look at invoices but not change them.");
    const body = (await req.json().catch(() => null)) as { upsert?: unknown; remove?: unknown } | null;
    const upsert = Array.isArray(body?.upsert) ? body.upsert : [];
    const remove = Array.isArray(body?.remove) ? body.remove : [];
    if (upsert.length + remove.length === 0) return NextResponse.json({ ok: true, saved: 0, removed: 0 });
    if (upsert.length + remove.length > MAX_CHANGES) return fail(400, "too_many", `Save at most ${MAX_CHANGES} invoices at a time.`);
    if (!upsert.every(isBillingInvoice) || !remove.every((id) => typeof id === "string" && id.length > 0 && id.length <= 80)) return fail(400, "invalid", "An invoice is missing something it needs.");
    const ids = upsert.map((i) => i.id);
    if (new Set(ids).size !== ids.length) return fail(400, "invalid", "The same invoice was sent twice.");

    if (upsert.length > 0) {
      const { error } = await supabase.from("control_invoices").upsert(upsert.map(toRow), { onConflict: "id" });
      if (error) {
        if (error.code === "42501") return fail(403, "read_only", "Your role cannot change invoices.");
        if (error.code === "23514") return fail(400, "invalid", "An invoice is too large.");
        throw error;
      }
    }
    if (remove.length > 0) {
      const { error } = await supabase.from("control_invoices").delete().in("id", remove as string[]);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, saved: upsert.length, removed: remove.length });
  }, "billing");
}
