import { describe, expect, it } from "vitest";
import { AUTO_PROJECT_ID, MAX_NEW_PER_RUN, followUps, withNewTasks, type AutoSources } from "@/lib/projects/auto-tasks";

const T = "2026-11-24";
const none: AutoSources = { licenses: [], invoices: [], vendors: [], equipment: [], packets: [] };
const lic = (o: Record<string, unknown> = {}) => ({ id: "l1", name: "Contractor license", expiresOn: "2026-12-10", reminderDays: [60, 30], stage: "not_started", ...o }) as never;
const inv = (o: Record<string, unknown> = {}) => ({ id: "i1", number: "INV-7", client: "Zed Co", dueOn: "2026-11-01", status: "sent", ...o }) as never;
const equip = (o: Record<string, unknown> = {}) => ({ id: "e1", name: "Van 2", status: "in_service", nextServiceOn: "2026-12-01", nextInspectionOn: null, warrantyEndsOn: null, assignedTo: "", location: "", ...o }) as never;
const ghosted = () => ({ id: "v1", name: "Blue Ridge", status: "active", documents: [{ id: "d", type: "COI", required: true, expiresOn: null, receivedOn: null }], activity: ["2026-10-01", "2026-10-08", "2026-10-15"].map((on, i) => ({ id: `n${i}`, on, kind: "reminder", text: "x", by: "AdFlo" })) }) as never;

describe("followUps", () => {
  it("asks for a renewal task once the window opens, unless it is already submitted or long past", () => {
    expect(followUps({ ...none, licenses: [lic()] }, T).map((t) => t.title)).toEqual(["Renew Contractor license"]);
    expect(followUps({ ...none, licenses: [lic({ expiresOn: "2027-06-01" })] }, T)).toEqual([]);
    expect(followUps({ ...none, licenses: [lic({ stage: "submitted" })] }, T)).toEqual([]);
    expect(followUps({ ...none, licenses: [lic({ expiresOn: "2026-06-01" })] }, T)).toEqual([]);
  });

  it("is due two weeks before expiry, or today when that has passed", () => {
    expect(followUps({ ...none, licenses: [lic({ expiresOn: "2026-12-30" })] }, T)[0].dueOn).toBe("2026-12-16");
    expect(followUps({ ...none, licenses: [lic({ expiresOn: "2026-12-02" })] }, T)[0].dueOn).toBe(T);
  });

  it("covers equipment, late invoices, and vendors and packets gone quiet", () => {
    const out = followUps({ ...none, equipment: [equip(), equip({ id: "e2", nextServiceOn: "2027-03-01" })], invoices: [inv(), inv({ id: "i2", dueOn: "2026-11-20" }), inv({ id: "i3", status: "paid" })], vendors: [ghosted()] }, T);
    expect(out.map((t) => t.key).sort()).toEqual(["eq:eq-e1-svc:2026-12-01", "inv:i1", "vendor:v1:2026-10-15"]);
  });

  it("keeps names to one line", () => {
    expect(followUps({ ...none, invoices: [inv({ client: "Zed\r\nBcc: x@y.z" })] }, T)[0].title).not.toMatch(/[\r\n]/);
  });
});

describe("withNewTasks", () => {
  const wanted = followUps({ ...none, licenses: [lic()], invoices: [inv()] }, T);

  it("starts the follow-up project and adds each task once", () => {
    const first = withNewTasks(null, wanted, T)!;
    expect(first.project.id).toBe(AUTO_PROJECT_ID);
    expect(first.project.tasks).toHaveLength(2);
    expect(withNewTasks(first.project, wanted, T)).toBeNull();
  });

  it("never brings back a task that was finished or deleted", () => {
    const first = withNewTasks(null, wanted, T)!;
    const deleted = { ...first.project, tasks: [] };
    expect(withNewTasks(deleted, wanted, T)).toBeNull();
  });

  it("a renewed license is a new situation", () => {
    const first = withNewTasks(null, wanted, T)!;
    const renewed = followUps({ ...none, licenses: [lic({ expiresOn: "2027-12-10" })] }, "2027-11-24");
    expect(withNewTasks(first.project, renewed, "2027-11-24")!.added).toHaveLength(1);
  });

  it("adds no more than the cap in one run", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ key: `inv:${i}`, title: `T${i}`, dueOn: T }));
    expect(withNewTasks(null, many, T)!.added).toHaveLength(MAX_NEW_PER_RUN);
  });
});
