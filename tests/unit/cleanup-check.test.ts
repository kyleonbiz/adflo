import { describe, expect, it } from "vitest";
import { cleanupCheck } from "@/lib/control/health";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("cleanupCheck", () => {
  it("warns when the secret is missing", () => {
    expect(cleanupCheck(false, null, NOW).level).toBe("warn");
  });
  it("warns that it has not run yet", () => {
    const c = cleanupCheck(true, null, NOW);
    expect(c.level).toBe("warn");
    expect(c.detail).toMatch(/not run yet/i);
  });
  it("is ok after a recent good run", () => {
    const c = cleanupCheck(true, { ran_at: ago(9), ok: true, detail: "0 stale uploads found, 0 files removed." }, NOW);
    expect(c.level).toBe("ok");
    expect(c.detail).toMatch(/9 hours ago/);
  });
  it("warns when the last run is older than a missed night", () => {
    const c = cleanupCheck(true, { ran_at: ago(40), ok: true, detail: "" }, NOW);
    expect(c.level).toBe("warn");
    expect(c.detail).toMatch(/Vercel/);
  });
  it("warns when the last run hit a problem", () => {
    const c = cleanupCheck(true, { ran_at: ago(2), ok: false, detail: "1 file could not be removed." }, NOW);
    expect(c.level).toBe("warn");
    expect(c.detail).toMatch(/problem/);
  });
});
