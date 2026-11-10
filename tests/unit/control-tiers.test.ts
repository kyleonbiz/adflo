import { describe, expect, it } from "vitest";
import { TIERS, FEATURE_KEYS, cleanFeatures, hasFeature } from "@/lib/control/tiers";
import { parsePlanInput } from "@/lib/control/validation";

describe("tiers", () => {
  const by = Object.fromEntries(TIERS.map((t) => [t.name, t.features]));
  it("offers two tiers, Core + being Core plus more", () => {
    expect(TIERS.map((t) => t.name)).toEqual(["core", "core +"]);
    expect(by["core +"]).toEqual(expect.arrayContaining([...by.core]));
  });
  it("keeps every module and the automations in Core", () => {
    for (const k of ["invoices", "vendors", "forms", "licenses", "reporting_scheduled", "activity", "assistant_rules"] as const) expect(hasFeature(by.core, k)).toBe(true);
  });
  it("puts only the Claude assistant, OCR and priority support in Core +", () => {
    for (const k of ["assistant_ai", "ocr", "priority_support"] as const) {
      expect(hasFeature(by.core, k)).toBe(false);
      expect(hasFeature(by["core +"], k)).toBe(true);
    }
    expect(by["core +"].length - by.core.length).toBe(3);
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
  const core = TIERS[0].features as string[];
  it("lets Core use every page", () => {
    for (const p of ["/app", "/app/invoices", "/app/vendors/x", "/app/activity", "/app/assistant", "/app/reporting"]) expect(pathAllowed(core, p)).toBe(true);
  });
  it("hides a page a custom plan leaves out", () => {
    expect(pathAllowed(["documents"], "/app/invoices")).toBe(false);
    expect(pathAllowed(["documents"], "/app/vendors/abc")).toBe(false);
  });
  it("always allows the Dashboard, Settings and unlisted pages", () => {
    for (const p of ["/app/overview", "/app/setup", "/app/file-reset"]) expect(pathAllowed([], p)).toBe(true);
  });
  it("allows everything when the plan has no list", () => {
    expect(pathAllowed(null, "/app/activity")).toBe(true);
    expect(itemAllowed(null, "invoices")).toBe(true);
  });
  it("filters sidebar items the same way", () => {
    expect(itemAllowed(["documents"], "invoices")).toBe(false);
    expect(itemAllowed(core, "crm")).toBe(true);
  });
});
