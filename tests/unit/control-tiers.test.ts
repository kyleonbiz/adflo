import { describe, expect, it } from "vitest";
import { TIERS, CORE, FEATURE_KEYS, cleanFeatures, hasFeature, limitsFor, ADD_ONS } from "@/lib/control/tiers";
import { parsePlanInput } from "@/lib/control/validation";

describe("tiers", () => {
  const by = Object.fromEntries(TIERS.map((t) => [t.name, t.features]));
  it("offers two plans, Core + and Enterprise (Core is retired)", () => {
    expect(TIERS.map((t) => t.name)).toEqual(["core +", "enterprise"]);
  });
  it("keeps every module and the automations in Core + and Enterprise", () => {
    for (const t of TIERS) for (const k of ["invoices", "vendors", "forms", "licenses", "reporting_scheduled", "activity", "assistant_rules", "assistant_ai", "ocr", "priority_support"] as const) expect(hasFeature(t.features, k)).toBe(true);
  });
  it("leaves the Claude assistant, OCR and priority support out of the retired Core list", () => {
    for (const k of ["assistant_ai", "ocr", "priority_support"] as const) expect(hasFeature(CORE, k)).toBe(false);
    expect(by["core +"].length - CORE.length).toBe(3);
  });
  it("sets the decided prices and limits", () => {
    expect(limitsFor("Core +")).toMatchObject({ priceCents: 5900, annualCents: 59000, seats: 3, storageGb: 20, maxFileMb: 50, aiActions: 250, ocrPerMonth: 200, tokenBackstop: 3_000_000 });
    expect(limitsFor("enterprise")).toMatchObject({ priceCents: 19900, seats: 25, storageGb: 100, maxFileMb: 100, aiActions: 750, ocrPerMonth: 1000 });
    expect(limitsFor("core")).toBeNull();
    expect(TIERS.map((t) => t.seatsIncluded)).toEqual([3, 25]);
    expect(ADD_ONS.map((a) => a.priceCents)).toEqual([1000, 1000, 1500]);
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
  it("lets Core + use every page", () => {
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
