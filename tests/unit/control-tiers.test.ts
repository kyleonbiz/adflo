import { describe, expect, it } from "vitest";
import { TIERS, FEATURE_KEYS, cleanFeatures, hasFeature } from "@/lib/control/tiers";
import { parsePlanInput } from "@/lib/control/validation";

describe("tiers", () => {
  const by = Object.fromEntries(TIERS.map((t) => [t.name, t.features]));
  it("offers three tiers, each a superset of the one before", () => {
    expect(TIERS.map((t) => t.name)).toEqual(["essentials", "business", "complete"]);
    expect(by.business).toEqual(expect.arrayContaining([...by.essentials]));
    expect(by.complete).toEqual(expect.arrayContaining([...by.business]));
  });
  it("puts invoices in Business and above, not Essentials", () => {
    expect(hasFeature(by.essentials, "invoices")).toBe(false);
    expect(hasFeature(by.business, "invoices")).toBe(true);
    expect(hasFeature(by.complete, "invoices")).toBe(true);
  });
  it("keeps the costly extras in Complete only", () => {
    for (const k of ["assistant_ai", "ocr", "activity", "reporting_scheduled"] as const) {
      expect(hasFeature(by.business, k)).toBe(false);
      expect(hasFeature(by.complete, k)).toBe(true);
    }
  });
  it("treats a plan with no list as including everything", () => {
    expect(hasFeature(null, "ocr")).toBe(true);
  });
  it("only uses known feature keys", () => {
    for (const t of TIERS) for (const k of t.features) expect(FEATURE_KEYS).toContain(k);
  });
  it("cleans and validates feature lists", () => {
    expect(cleanFeatures(["ocr", "ocr", "nope", 3])).toEqual(["ocr"]);
    expect(parsePlanInput({ features: ["forms", "bogus"] }, true)).toEqual({ ok: true, value: { features: ["forms"] } });
    expect(parsePlanInput({ features: "forms" }, true).ok).toBe(false);
  });
});

import { itemAllowed, pathAllowed } from "@/lib/control/gating";

describe("gating", () => {
  const essentials = TIERS[0].features as string[];
  const business = TIERS[1].features as string[];
  it("hides gated pages from a plan that lacks them", () => {
    expect(pathAllowed(essentials, "/app/invoices")).toBe(false);
    expect(pathAllowed(essentials, "/app/vendors/abc")).toBe(false);
    expect(pathAllowed(business, "/app/invoices")).toBe(true);
    expect(pathAllowed(business, "/app/activity")).toBe(false);
  });
  it("always allows Home, Settings and unlisted pages", () => {
    for (const p of ["/app/overview", "/app/setup", "/app/file-reset"]) expect(pathAllowed([], p)).toBe(true);
    expect(pathAllowed(essentials, "/app")).toBe(true);
  });
  it("allows everything when the plan has no list", () => {
    expect(pathAllowed(null, "/app/activity")).toBe(true);
    expect(itemAllowed(null, "invoices")).toBe(true);
  });
  it("filters sidebar items the same way", () => {
    expect(itemAllowed(essentials, "invoices")).toBe(false);
    expect(itemAllowed(essentials, "crm")).toBe(true);
    expect(itemAllowed(business, "assistant")).toBe(true);
  });
});
