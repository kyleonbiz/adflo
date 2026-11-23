import { describe, expect, it } from "vitest";
import { TIERS, PRICE_CENTS, ANNUAL_PRICE_CENTS, FEATURE_KEYS, cleanFeatures, hasFeature } from "@/lib/control/tiers";
import { parsePlanInput } from "@/lib/control/validation";

describe("tiers", () => {
  const all = TIERS[0].features;
  it("offers one plan, adflo, at $149 a month", () => {
    expect(TIERS.map((t) => t.name)).toEqual(["adflo"]);
    expect(TIERS[0].priceCents).toBe(14900);
    expect(PRICE_CENTS).toBe(14900);
  });
  it("bills a year as ten months (two free)", () => {
    expect(ANNUAL_PRICE_CENTS).toBe(PRICE_CENTS * 10);
  });
  it("includes every feature, the assistant, OCR and priority support too", () => {
    for (const k of FEATURE_KEYS) expect(all).toContain(k);
    for (const k of ["assistant_ai", "ocr", "priority_support", "invoices", "vendors", "forms", "licenses"] as const) expect(hasFeature(all, k)).toBe(true);
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
