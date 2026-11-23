import { describe, expect, it } from "vitest";
import { checkLimit, NO_USAGE } from "@/lib/control/usage";

const used = (u: Partial<typeof NO_USAGE>) => ({ ...NO_USAGE, ...u });

describe("checkLimit", () => {
  it("allows Claude actions up to 250 a month on Core +, then refuses with the add-on", () => {
    expect(checkLimit("core +", used({ aiActions: 249 }), "ai")).toEqual({ ok: true });
    const v = checkLimit("Core +", used({ aiActions: 250 }), "ai");
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.code).toBe("limit_reached"); expect(v.message).toMatch(/250 Claude actions/); expect(v.message).toMatch(/\$15/); expect(v.message).toMatch(/quick actions still work/); }
  });
  it("stops at the ~3M token backstop even under the action cap", () => {
    expect(checkLimit("core +", used({ aiActions: 10, tokens: 2_999_999 }), "ai").ok).toBe(true);
    expect(checkLimit("core +", used({ aiActions: 10, tokens: 3_000_000 }), "ai").ok).toBe(false);
  });
  it("gives Enterprise 750 actions, no token backstop, and a contact line instead of a price", () => {
    expect(checkLimit("enterprise", used({ aiActions: 749, tokens: 50_000_000 }), "ai").ok).toBe(true);
    const v = checkLimit("enterprise", used({ aiActions: 750 }), "ai");
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.message).toMatch(/account manager/); expect(v.message).not.toMatch(/\$15/); }
  });
  it("limits OCR reads to 200 on Core + and 1,000 on Enterprise", () => {
    expect(checkLimit("core +", used({ ocrReads: 199 }), "ocr").ok).toBe(true);
    expect(checkLimit("core +", used({ ocrReads: 200 }), "ocr").ok).toBe(false);
    expect(checkLimit("enterprise", used({ ocrReads: 999 }), "ocr").ok).toBe(true);
    expect(checkLimit("enterprise", used({ ocrReads: 1000 }), "ocr").ok).toBe(false);
  });
  it("never limits quick actions, legacy or retired plans, or an unknown plan", () => {
    expect(checkLimit("core +", used({ quickActions: 1_000_000 }), "ai").ok).toBe(true);
    for (const plan of ["standard", "core", null, undefined]) {
      expect(checkLimit(plan, used({ aiActions: 9999, ocrReads: 9999, tokens: 9e9 }), "ai").ok).toBe(true);
      expect(checkLimit(plan, used({ ocrReads: 9999 }), "ocr").ok).toBe(true);
    }
  });
});
