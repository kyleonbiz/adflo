import { describe, expect, it } from "vitest";
import { classifyProbe, overallLevel } from "@/lib/status";

describe("status", () => {
  it("worst level wins", () => {
    expect(overallLevel([])).toBe("operational");
    expect(overallLevel([{ level: "operational" }, { level: "degraded" }])).toBe("degraded");
    expect(overallLevel([{ level: "degraded" }, { level: "down" }])).toBe("down");
  });
  it("classifies probes without leaking details", () => {
    expect(classifyProbe("X", true, 100).level).toBe("operational");
    expect(classifyProbe("X", true, 2000).level).toBe("degraded");
    expect(classifyProbe("X", false, 10)).toEqual({ name: "X", level: "down", detail: "Not responding." });
  });
});
