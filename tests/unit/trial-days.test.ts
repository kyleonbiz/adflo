import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, trialDays } from "@/lib/billing/trial";

describe("trialDays", () => {
  it("is three days unless a whole number from 1 to 30 is set", () => {
    for (const raw of [undefined, "", " ", "abc", "0", "31", "-2", "2.5", "NaN", "1e3"]) expect(trialDays(raw)).toBe(3);
    expect(trialDays("14")).toBe(14);
    expect(trialDays("1")).toBe(1);
    expect(trialDays("30")).toBe(30);
  });

  it("is three days in a normal build", () => {
    expect(TRIAL_DAYS).toBe(3);
  });
});
