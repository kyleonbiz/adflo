import { describe, expect, it } from "vitest";
import { logAutomation } from "@/lib/audit/server";
import { parseAudit } from "@/lib/audit/logic";

function fake(fail = false) {
  const calls: { rows: Record<string, unknown>[]; opts: unknown }[] = [];
  return { calls, admin: { from: () => ({ upsert: async (rows: Record<string, unknown>[], opts: unknown) => { if (fail) throw new Error("x"); calls.push({ rows, opts }); return { error: null }; } }) } as never };
}

describe("logAutomation", () => {
  it("writes lines named AdFlo that the activity page accepts, once per job, day and thing", async () => {
    const f = fake();
    await logAutomation(f.admin, "w1", "2026-11-24", [{ job: "vendor-chase", key: "v1", verb: "emailed a reminder to", what: "Blue\r\nRidge about missing documents", area: "Vendors", href: "/app/vendors" }]);
    const row = f.calls[0].rows[0] as { id: string; workspace_id: string; data: Record<string, string> };
    expect(row).toMatchObject({ workspace_id: "w1", id: "auto-vendor-chase-2026-11-24-v1", data: { by: "AdFlo", area: "Vendors" } });
    expect(f.calls[0].opts).toMatchObject({ ignoreDuplicates: true });
    expect(row.data.what).not.toMatch(/[\r\n]/);
    expect(parseAudit(JSON.stringify([{ ...row.data, id: row.id, at: "2026-11-24T12:00:00Z" }]))).toHaveLength(1);
  });

  it("never throws, sends nothing when empty, and keeps links inside the app", async () => {
    await expect(logAutomation(fake(true).admin, "w1", "2026-11-24", [{ job: "j", key: "k", verb: "v", what: "w", area: "Tasks", href: "/app" }])).resolves.toBeUndefined();
    const f = fake();
    await logAutomation(f.admin, "w1", "2026-11-24", []);
    expect(f.calls).toEqual([]);
    await logAutomation(f.admin, "w1", "2026-11-24", [{ job: "j", key: "k", verb: "v", what: "w", area: "Tasks", href: "https://evil.test" }]);
    expect((f.calls[0].rows[0] as { data: { href: string } }).data.href).toBe("/app");
  });
});
