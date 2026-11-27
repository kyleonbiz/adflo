import { describe, expect, it } from "vitest";
import { HEALTH_ROWS, buildHealth } from "@/lib/dashboard/health";
import type { DashboardSources } from "@/lib/dashboard/logic";

const T = "2026-11-27";
const day = (n: number) => new Date(Date.parse(`${T}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const none: DashboardSources = { invoices: [], licenses: [], projects: [], vendors: [], equipment: [] };
const lic = (id: string, name: string, n: number, o: Record<string, unknown> = {}) => ({ id, name, category: "business", expiresOn: day(n), reminderDays: [30], requiredDocuments: [], stage: "not_started", ...o }) as never;
const vendor = (o: Record<string, unknown> = {}) => ({ id: "v1", name: "Blue Ridge", status: "active", documents: [], ...o }) as never;
const equip = (id: string, o: Record<string, unknown> = {}) => ({ id, name: "Van 2", status: "in_service", nextServiceOn: null, nextInspectionOn: null, warrantyEndsOn: null, assignedTo: "", location: "", ...o }) as never;
const task = (id: string, done: boolean, doneOn: string | null) => ({ id, title: id, done, doneOn, dueOn: null });

describe("buildHealth", () => {
  it("is clear and zero for a business with nothing yet", () => {
    const h = buildHealth(none, T, "/app", null);
    expect(h.status).toBe("clear");
    expect(h.rows).toEqual([]);
    expect(h.tiles.map((t) => [t.id, t.value])).toEqual([["assets", 0], ["renewals", 0], ["tasks", 0]]); // no documents tile when the count is unknown
  });

  it("counts documents, assets, renewals and recent tasks", () => {
    const h = buildHealth({
      ...none,
      licenses: [lic("a", "Contractor license", 26), lic("b", "General liability insurance", 18, { category: "insurance" }), lic("c", "Far away", 200)],
      vendors: [vendor({ documents: [{ id: "d", type: "COI", required: true, receivedOn: day(-10), expiresOn: day(40) }] })],
      equipment: [equip("e1"), equip("e2", { status: "in_repair" }), equip("e3", { status: "retired" })],
      projects: [{ id: "p", name: "P", tasks: [task("t1", true, day(-3)), task("t2", true, day(-40)), task("t3", false, null)] }] as never,
    }, T, "/app", 42);
    const v = (id: string) => h.tiles.find((t) => t.id === id)!.value;
    expect([v("documents"), v("assets"), v("renewals"), v("tasks")]).toEqual([42, 2, 3, 1]); // two licenses and the vendor certificate; one task in the last 30 days
  });

  it("lists what needs attention, late first, then missing records, then soonest", () => {
    const h = buildHealth({
      ...none,
      licenses: [lic("a", "Contractor license", 26), lic("b", "General liability insurance", 18, { category: "insurance" }), lic("late", "Old permit", -5)],
      vendors: [vendor({ documents: [{ id: "w9", type: "W-9", required: true, receivedOn: null, expiresOn: null }] })],
      equipment: [equip("e1", { nextInspectionOn: day(30) })],
    }, T, "/app", null);
    expect(h.rows.map((r) => [r.label, r.days])).toEqual([["Old permit", -5], ["W-9 missing", null], ["General liability insurance", 18], ["Contractor license", 26], ["Inspection: Van 2", 30]]);
    expect(h.rows[0].tone).toBe("danger");
    expect(h.rows[2]).toMatchObject({ detail: "Insurance", tone: "warning", href: "/app/licenses" });
    expect(h.status).toBe("attention");
  });

  it("leaves out dates beyond 60 days, inactive vendors, retired equipment and warranties", () => {
    const h = buildHealth({
      ...none,
      licenses: [lic("far", "Far", 90)],
      vendors: [vendor({ status: "inactive", documents: [{ id: "d", type: "COI", required: true, receivedOn: null, expiresOn: null }] })],
      equipment: [equip("e1", { warrantyEndsOn: day(20) }), equip("e2", { status: "retired", nextServiceOn: day(10) })],
    }, T, "/app", null);
    expect(h.rows).toEqual([]);
    expect(h.status).toBe("clear");
  });

  it("is only a watch when nothing is late, and cuts a long list but says how many there are", () => {
    const many = Array.from({ length: 12 }, (_, i) => lic(`l${i}`, `License ${i}`, 10 + i));
    const h = buildHealth({ ...none, licenses: many }, T, "/app", null);
    expect(h.status).toBe("watch");
    expect(h.rows).toHaveLength(HEALTH_ROWS);
    expect(h.total).toBe(12);
  });
});
