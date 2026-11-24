import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ role: "owner", upserts: [] as unknown[][], deletes: [] as string[][], upsertError: null as { code: string } | null }));
vi.mock("@/lib/control/api", () => ({
  fail: (status: number, code: string, message: string) => Response.json({ ok: false, error: { code, message } }, { status }),
  staffRoute: async (_req: Request, run: (ctx: { supabase: unknown; staff: { role: string } }) => Promise<Response>) => run({
    staff: { role: h.role },
    supabase: {
      from: () => ({
        upsert: async (rows: unknown[]) => { h.upserts.push(rows); return { error: h.upsertError }; },
        delete: () => ({ in: async (_c: string, ids: string[]) => { h.deletes.push(ids); return { error: null }; } }),
      }),
    },
  }),
}));

import { POST } from "@/app/api/control/billing/invoices/route";
import { diffInvoices, isBillingInvoice, toRow } from "@/lib/control/billing-db";
import type { Invoice } from "@/lib/invoices/types";

const CLIENT = "7a000000-0000-4000-8000-0000000000c1";
const inv = (o: Partial<Invoice> = {}): Invoice => ({ id: "inv-1", number: "INV-1", clientId: CLIENT, client: "Acme", clientEmail: "a@acme.test", description: "Plan", items: [{ description: "Plan", qty: 1, rateCents: 5000 }], taxRate: 0, sender: { name: "AdFlo", address: "", phone: "", email: "billing@adflo.pro" }, paymentMethods: [], amountCents: 5000, issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "draft", paidOn: null, recurrence: "none", reminderDays: [], notes: "", ...o }) as Invoice;
const call = (body: unknown) => POST(new Request("https://www.adflo.pro/api/control/billing/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => { h.role = "owner"; h.upserts = []; h.deletes = []; h.upsertError = null; });

describe("billing invoice helpers", () => {
  it("accepts a well-formed invoice and rejects damaged ones", () => {
    expect(isBillingInvoice(inv())).toBe(true);
    for (const bad of [null, "x", {}, inv({ items: [] }), inv({ status: "paidd" as never }), inv({ amountCents: NaN }), { ...inv(), sender: null }, inv({ id: "x".repeat(81) })]) expect(isBillingInvoice(bad)).toBe(false);
  });

  it("makes a row, linking the client only when it is a real id", () => {
    expect(toRow(inv())).toMatchObject({ id: "inv-1", client_id: CLIENT });
    expect(toRow(inv({ clientId: "not-a-uuid" })).client_id).toBeNull();
    expect(toRow(inv({ clientId: undefined })).client_id).toBeNull();
  });

  it("says what changed, whatever the order", () => {
    const a = inv({ id: "a" }), b = inv({ id: "b" }), c = inv({ id: "c" });
    const d = diffInvoices([a, b, c], [{ ...c }, { ...b, status: "paid" }, inv({ id: "d" })]);
    expect(d.upsert.map((i) => i.id).sort()).toEqual(["b", "d"]);
    expect(d.remove).toEqual(["a"]);
    expect(diffInvoices([a], [a])).toEqual({ upsert: [], remove: [] });
  });
});

describe("POST /api/control/billing/invoices", () => {
  it("saves the changes and removes the deleted", async () => {
    const res = await call({ upsert: [inv(), inv({ id: "inv-2", number: "INV-2" })], remove: ["old-1"] });
    expect(await res.json()).toMatchObject({ ok: true, saved: 2, removed: 1 });
    expect(h.upserts[0]).toHaveLength(2);
    expect(h.deletes).toEqual([["old-1"]]);
  });

  it("is open to the owner and billing roles, and closed to support", async () => {
    h.role = "billing";
    expect((await call({ upsert: [inv()], remove: [] })).status).toBe(200);
    h.role = "support";
    const res = await call({ upsert: [inv()], remove: [] });
    expect(res.status).toBe(403);
    expect(h.upserts).toHaveLength(1);
  });

  it("refuses a damaged invoice, a duplicate, too many, and does nothing for an empty request", async () => {
    expect((await call({ upsert: [{ id: "x" }], remove: [] })).status).toBe(400);
    expect((await call({ upsert: [inv(), inv()], remove: [] })).status).toBe(400);
    expect((await call({ upsert: [], remove: [7] })).status).toBe(400);
    expect((await call({ upsert: Array.from({ length: 201 }, (_, i) => inv({ id: `i${i}` })), remove: [] })).status).toBe(400);
    expect(await (await call({})).json()).toMatchObject({ ok: true, saved: 0 });
    expect(h.upserts).toEqual([]);
  });

  it("reports what the database refused", async () => {
    h.upsertError = { code: "42501" };
    expect((await call({ upsert: [inv()], remove: [] })).status).toBe(403);
    h.upsertError = { code: "23514" };
    expect((await call({ upsert: [inv()], remove: [] })).status).toBe(400);
  });
});
