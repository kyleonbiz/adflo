import { describe, expect, it } from "vitest";
import { advance, cleanSteps, currentApprover, describeProgress, parseChains, startProgress, MAX_STEPS } from "@/lib/approvals/chain";

const T = "2026-10-26";

describe("approval chain", () => {
  it("cleans names: trims, drops blanks and repeats, caps the length", () => {
    expect(cleanSteps([" Manager ", "", "manager", "Finance"])).toEqual(["Manager", "Finance"]);
    expect(cleanSteps(Array.from({ length: 10 }, (_, i) => `P${i}`))).toHaveLength(MAX_STEPS);
  });

  it("walks each approver in order and is approved only after the last", () => {
    let p = startProgress(["Manager", "Finance", "Owner"]);
    expect(currentApprover(p)).toBe("Manager");
    expect(describeProgress(p)).toBe("Step 1 of 3: waiting on Manager");
    let r = advance(p, "approved", T, "ok");
    expect(r.outcome).toBe("pending");
    p = r.progress;
    expect(currentApprover(p)).toBe("Finance");
    r = advance(p, "approved", T);
    expect(r.outcome).toBe("pending");
    r = advance(r.progress, "approved", T);
    expect(r.outcome).toBe("approved");
    expect(currentApprover(r.progress)).toBeNull();
    expect(r.progress.log.map((e) => e.by)).toEqual(["Manager", "Finance", "Owner"]);
  });

  it("stops at the first decline, and ignores further decisions", () => {
    const first = advance(startProgress(["A", "B"]), "approved", T).progress;
    const declined = advance(first, "declined", T, "too much");
    expect(declined.outcome).toBe("declined");
    expect(currentApprover(declined.progress)).toBeNull();
    expect(advance(declined.progress, "approved", T).outcome).toBe("declined");
    expect(advance(declined.progress, "approved", T).progress).toBe(declined.progress);
  });

  it("uses the fallback approver when no chain is set, and has no approver when there is none", () => {
    expect(startProgress([], "Operations manager").steps).toEqual(["Operations manager"]);
    expect(describeProgress(startProgress([], "Operations manager"))).toBe("Waiting on Operations manager");
    expect(startProgress([]).steps).toEqual([]);
  });

  it("reads saved chains defensively", () => {
    expect(parseChains("nope")).toEqual({ requests: [], forms: [] });
    expect(parseChains(JSON.stringify({ requests: ["A", 3, "B"], forms: "x" }))).toEqual({ requests: ["A", "B"], forms: [] });
  });
});
