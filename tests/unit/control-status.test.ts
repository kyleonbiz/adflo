import { describe, expect, it } from "vitest";
import { isAccountOn, statusAfterSwitch } from "@/lib/control/status";

describe("account switch", () => {
  it("trial and active are on; suspended and cancelled are off", () => {
    expect(["trial", "active", "suspended", "cancelled"].map((s) => isAccountOn(s as never))).toEqual([true, true, false, false]);
  });
  it("turning off always suspends", () => {
    for (const s of ["trial", "active", "suspended", "cancelled"] as const) expect(statusAfterSwitch(s, false)).toBe("suspended");
  });
  it("turning on returns a trial to a trial, and reactivates everyone else", () => {
    expect(statusAfterSwitch("trial", true)).toBe("trial");
    expect(statusAfterSwitch("active", true)).toBe("active");
    expect(statusAfterSwitch("suspended", true)).toBe("active");
    expect(statusAfterSwitch("cancelled", true)).toBe("active");
  });
});
