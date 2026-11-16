import { describe, expect, it } from "vitest";
import { GUIDE, GUIDE_SECTIONS } from "@/lib/control/onboarding-guide";
import { CHECKLIST_STEPS } from "@/lib/control/types";

describe("onboarding guide", () => {
  it("has instructions for every checklist step, and nothing extra", () => {
    expect(Object.keys(GUIDE).sort()).toEqual(CHECKLIST_STEPS.map((s) => s.key).sort());
  });
  it("gives each step a reason, at least two instructions, and no empty text", () => {
    for (const s of CHECKLIST_STEPS) {
      const g = GUIDE[s.key];
      expect(g.key).toBe(s.key);
      expect(g.why.trim().length, s.key).toBeGreaterThan(10);
      expect(g.how.length, s.key).toBeGreaterThanOrEqual(2);
      for (const line of g.how) expect(line.trim().length, `${s.key}: ${line}`).toBeGreaterThan(5);
      expect(g.actions.length, s.key).toBeGreaterThan(0);
    }
  });
  it("only jumps to sections that exist on the page, and links stay inside the Control center", () => {
    for (const g of Object.values(GUIDE)) for (const a of g.actions) {
      if (a.kind === "edit") continue;
      const to = a.to!("11111111-1111-4111-8111-111111111111");
      if (a.kind === "jump") expect(GUIDE_SECTIONS as readonly string[], to).toContain(to.slice(1));
      else expect(to.startsWith("/control/"), to).toBe(true);
    }
  });
  it("starts with the details and ends with going live", () => {
    expect(CHECKLIST_STEPS[0].key).toBe("details");
    expect(CHECKLIST_STEPS.at(-1)!.key).toBe("live");
  });
});
