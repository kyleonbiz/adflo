import { describe, expect, it } from "vitest";
import { runTool, type ToolState } from "@/lib/assistant/tools";
import { INDUSTRIES, emptyConfig, liveFromRows, liveIndustries, selectableIndustries, setLiveIndustries, toggleError } from "@/lib/setup/types";
import { PRESETS } from "@/lib/setup/industries";

const fresh = (): ToolState => ({ config: emptyConfig(), today: "2026-01-15", links: [] });

describe("assistant tools", () => {
  it("has no tool that changes the account setup", () => {
    const s = fresh();
    for (const name of ["set_business_profile", "recommend_services", "deploy_services"]) expect(JSON.parse(runTool(s, name, { industry: "Construction & trades" })).error).toMatch(/unknown tool/i);
    expect(s.config).toEqual(emptyConfig());
    expect(s.links).toEqual([]);
  });
  it("reads the setup without changing it", () => {
    const s = fresh();
    expect(JSON.parse(runTool(s, "get_status", {}))).toHaveProperty("score");
    expect(JSON.parse(runTool(s, "list_services", {})).length).toBeGreaterThan(0);
    expect(s.config).toEqual(emptyConfig());
  });
  it("only offers open industries, while every industry stays built", () => {
    expect(liveIndustries()).toEqual(["Construction & trades"]);
    expect(selectableIndustries("Real estate")).toEqual(["Construction & trades", "Real estate"]);
    expect(selectableIndustries("")).toEqual(["Construction & trades"]);
    expect(INDUSTRIES.every((i) => i in PRESETS)).toBe(true);
    setLiveIndustries(["Construction & trades", "Real estate"]);
    try { expect(liveIndustries()).toContain("Real estate"); } finally { setLiveIndustries(null); }
  });
  it("works out the open list from saved rows and refuses to close the last one", () => {
    expect(liveFromRows([])).toEqual(["Construction & trades"]);
    expect(liveFromRows([{ industry: "Legal", live: true }, { industry: "Construction & trades", live: true }, { industry: "Nope", live: true }])).toEqual(["Construction & trades", "Legal"]);
    expect(liveFromRows([{ industry: "Legal", live: false }])).toEqual(["Construction & trades"]);
    expect(toggleError(["Legal"], "Legal", false)).toMatch(/at least one/i);
    expect(toggleError(["Legal", "Nonprofit"], "Legal", false)).toBeNull();
    expect(toggleError(["Legal"], "Spaceships", true)).toMatch(/unknown/i);
  });
  it("ignores unknown tools", () => {
    expect(JSON.parse(runTool(fresh(), "rm_rf", {})).error).toBeDefined();
  });
});
