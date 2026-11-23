import { describe, expect, it } from "vitest";
import { TIERS, CORE, FEATURE_KEYS, cleanFeatures, hasFeature, limitsFor, ADD_ONS, PRICE_CENTS, SEAT_CENTS, ONBOARDING_MIN_CENTS, ONBOARDING_MAX_CENTS, monthlyCents } from "@/lib/control/tiers";
import { parsePlanInput } from "@/lib/control/validation";

describe("tiers", () => {
  const all = TIERS[0].features;
  it("offers one plan, adflo", () => {
    expect(TIERS.map((t) => t.name)).toEqual(["adflo"]);
    expect(limitsFor("AdFlo")).not.toBeNull();
    expect(limitsFor("core +")).toBeNull();
    expect(limitsFor("enterprise")).toBeNull();
  });
  it("prices it at $99 a month with the owner's seat, plus $10 a month per extra seat", () => {
    expect(PRICE_CENTS).toBe(9900);
    expect(SEAT_CENTS).toBe(1000);
    expect(TIERS[0].seatsIncluded).toBe(1);
    expect(limitsFor("adflo")).toMatchObject({ priceCents: 9900, seatCents: 1000, seats: 1, storageGb: 20, maxFileMb: 50, aiActions: 250, ocrPerMonth: 200, tokenBackstop: 3_000_000 });
  });
  it("charges the platform price for one seat and $10 for each seat after", () => {
    expect(monthlyCents(1)).toBe(9900);
    expect(monthlyCents(5)).toBe(13900);
    expect(monthlyCents(0)).toBe(9900);
    expect(monthlyCents(2.9)).toBe(10900);
  });
  it("bills a year as ten months (two free), seats included", () => {
    expect(limitsFor("adflo")).toMatchObject({ annualCents: 99000, seatAnnualCents: 10000 });
  });
  it("quotes a one-time onboarding fee of $300 to $500", () => {
    expect(ONBOARDING_MIN_CENTS).toBe(30000);
    expect(ONBOARDING_MAX_CENTS).toBe(50000);
  });
  it("keeps the extra-seat add-on at the plan's seat price", () => {
    expect(ADD_ONS[0].priceCents).toBe(SEAT_CENTS);
    expect(ADD_ONS.map((a) => a.priceCents)).toEqual([1000, 1000, 1500]);
  });
  it("includes every feature, the assistant, OCR and priority support too", () => {
    for (const k of FEATURE_KEYS) expect(all).toContain(k);
    for (const k of ["assistant_ai", "ocr", "priority_support", "invoices", "vendors", "forms", "licenses"] as const) expect(hasFeature(all, k)).toBe(true);
  });
  it("leaves the Claude assistant, OCR and priority support out of the retired Core list", () => {
    for (const k of ["assistant_ai", "ocr", "priority_support"] as const) expect(hasFeature(CORE, k)).toBe(false);
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
  it("lets the AdFlo plan use every page", () => {
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
