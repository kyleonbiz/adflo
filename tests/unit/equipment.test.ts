import { describe, expect, it } from "vitest";
import { equipmentAlerts, equipmentEvents, equipmentToCsv, logService, summarize, validateEquipment } from "@/lib/equipment/logic";
import type { Equipment } from "@/lib/equipment/types";

const eq = (over: Partial<Equipment> = {}): Equipment => ({
  id: "e1", name: "Ford F-150", type: "vehicle", identifier: "VIN123", location: "Yard", assignedTo: "Sam", status: "in_service",
  purchasedOn: "2025-01-01", warrantyEndsOn: null, nextServiceOn: null, nextInspectionOn: null, serviceVendor: "", notes: "", createdOn: "2026-01-01", ...over,
});
const today = "2026-11-21";

describe("equipment alerts", () => {
  it("flags overdue service as critical and upcoming as a warning", () => {
    expect(equipmentAlerts(eq({ nextServiceOn: "2026-11-01" }), today)[0]).toMatchObject({ severity: "critical", message: "Service overdue by 20 days" });
    expect(equipmentAlerts(eq({ nextInspectionOn: "2026-12-01" }), today)[0]).toMatchObject({ severity: "warning", message: "Inspection due in 10 days" });
    expect(equipmentAlerts(eq({ nextServiceOn: "2027-06-01" }), today)).toEqual([]);
  });
  it("mentions a warranty ending soon and a lost item, but nothing for retired ones", () => {
    expect(equipmentAlerts(eq({ warrantyEndsOn: "2026-12-15" }), today)[0].message).toBe("Warranty ends in 24 days");
    expect(equipmentAlerts(eq({ status: "lost" }), today)[0].message).toMatch(/lost/);
    expect(equipmentAlerts(eq({ status: "retired", nextServiceOn: "2020-01-01" }), today)).toEqual([]);
  });
  it("summarises", () => {
    const s = summarize([eq({ nextServiceOn: "2026-11-01" }), eq({ id: "b", nextServiceOn: "2026-12-01" }), eq({ id: "c", status: "in_repair" })], today);
    expect(s).toMatchObject({ total: 3, attention: 1, dueSoon: 1, inRepair: 1 });
  });
});

describe("service logging", () => {
  it("schedules the next service when it repeats and returns repairs to service", () => {
    const r = logService(eq({ serviceEveryDays: 90, status: "in_repair", nextServiceOn: "2026-11-01" }), today);
    expect(r).toMatchObject({ lastServiceOn: today, nextServiceOn: "2027-02-19", status: "in_service" });
    expect(logService(eq({ nextServiceOn: "2026-11-01" }), today).nextServiceOn).toBeNull();
  });
});

describe("validation, calendar and export", () => {
  const blank = { name: "x", purchasedOn: "", warrantyEndsOn: "", nextServiceOn: "", nextInspectionOn: "", serviceEveryDays: "" };
  it("requires a name and sane dates", () => {
    expect(validateEquipment({ ...blank, name: " " }).name).toBeTruthy();
    expect(validateEquipment({ ...blank, purchasedOn: "2026-05-01", warrantyEndsOn: "2026-01-01" }).warrantyEndsOn).toBeTruthy();
    expect(validateEquipment({ ...blank, serviceEveryDays: "0" }).serviceEveryDays).toBeTruthy();
    expect(validateEquipment(blank)).toEqual({});
  });
  it("lists active items' dates and neutralises spreadsheet formulas", () => {
    expect(equipmentEvents([eq({ nextServiceOn: "2026-12-01" }), eq({ id: "r", status: "retired", nextServiceOn: "2026-12-01" })], today)).toHaveLength(1);
    expect(equipmentToCsv([eq({ name: "=CMD()" })], today)).toContain("'=CMD()");
  });
});
