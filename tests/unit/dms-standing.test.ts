import { describe, expect, it } from "vitest";
import { isPaused, parseStanding, pausedText } from "@/lib/dms/standing";

describe("workspace standing", () => {
  it("only suspended and cancelled count as paused; anything else, including junk, is ok", () => {
    expect(["ok", "suspended", "cancelled", null, undefined, "trial", 5, ""].map(parseStanding)).toEqual(["ok", "suspended", "cancelled", "ok", "ok", "ok", "ok", "ok"]);
    expect(isPaused("ok")).toBe(false);
    expect(isPaused("suspended")).toBe(true);
    expect(isPaused("cancelled")).toBe(true);
  });
  it("says plainly that nothing is deleted and who to contact", () => {
    expect(pausedText("suspended").body).toMatch(/Nothing has been deleted.*Contact AdFlo/);
    expect(pausedText("cancelled").title).toMatch(/closed/);
  });
});
