import { describe, expect, it } from "vitest";
import { clampNumber, estimateAdminCost, formatUsd, formatWeeks } from "@/lib/marketing/admin-cost";

describe("estimateAdminCost", () => {
  it("works the example: 10 hours a week at $200 an hour", () => {
    const e = estimateAdminCost({ hoursPerWeek: 10, hourlyValue: 200, savedPct: 40, usedPct: 50 });
    expect(e.hoursPerYear).toBe(480);
    expect(e.annualCost).toBe(96_000);
    expect(e.workingWeeks).toBe(12);
    expect(e.hoursSaved).toBe(192);
    expect(e.recoverable).toBe(19_200);
  });

  it("never recovers more than the admin time costs", () => {
    const e = estimateAdminCost({ hoursPerWeek: 20, hourlyValue: 80, savedPct: 70, usedPct: 100 });
    expect(e.recoverable).toBeLessThanOrEqual(e.annualCost);
  });

  it("is zero when there is no admin time or no value to it", () => {
    expect(estimateAdminCost({ hoursPerWeek: 0, hourlyValue: 100, savedPct: 40, usedPct: 50 }).annualCost).toBe(0);
    expect(estimateAdminCost({ hoursPerWeek: 10, hourlyValue: 0, savedPct: 40, usedPct: 50 }).recoverable).toBe(0);
  });

  it("keeps the assumptions inside their limits and treats junk as the minimum", () => {
    const high = estimateAdminCost({ hoursPerWeek: 10, hourlyValue: 100, savedPct: 500, usedPct: 500 });
    expect(high.hoursSaved).toBe(480 * 0.7);
    expect(high.recoverable).toBe(480 * 0.7 * 100);
    const junk = estimateAdminCost({ hoursPerWeek: Number.NaN, hourlyValue: -5, savedPct: 40, usedPct: 50 });
    expect(junk).toEqual({ hoursPerYear: 0, workingWeeks: 0, annualCost: 0, hoursSaved: 0, recoverable: 0 });
  });
});

describe("clampNumber", () => {
  it("accepts numbers and numeric text, and bounds them", () => {
    expect(clampNumber("12.5", 0, 400)).toBe(12.5);
    expect(clampNumber(" 7 ", 0, 400)).toBe(7);
    expect(clampNumber(9999, 0, 400)).toBe(400);
    expect(clampNumber(-3, 0, 400)).toBe(0);
  });
  it("treats empty, text, null and Infinity as the minimum", () => {
    for (const v of ["", "abc", null, undefined, Infinity, {}]) expect(clampNumber(v, 5, 50)).toBe(5);
  });
});

describe("formatting", () => {
  it("formats dollars without cents", () => {
    expect(formatUsd(96_000)).toBe("$96,000");
    expect(formatUsd(1234.56)).toBe("$1,235");
  });
  it("says working weeks in plain words", () => {
    expect(formatWeeks(0)).toBe("0 working weeks");
    expect(formatWeeks(0.2)).toBe("under 1 working week");
    expect(formatWeeks(1)).toBe("1 working week");
    expect(formatWeeks(12)).toBe("12 working weeks");
  });
});
