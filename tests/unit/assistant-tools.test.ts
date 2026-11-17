import { describe, expect, it } from "vitest";
import { runTool, type ToolState } from "@/lib/assistant/tools";
import { INDUSTRIES, LIVE_INDUSTRIES, emptyConfig, selectableIndustries } from "@/lib/setup/types";
import { PRESETS } from "@/lib/setup/industries";

const fresh = (): ToolState => ({ config: emptyConfig(), today: "2026-01-15", links: [] });

describe("assistant tools", () => {
  it("refuses to recommend or deploy before the profile is saved", () => {
    const s = fresh();
    expect(JSON.parse(runTool(s, "recommend_services", {})).error).toMatch(/industry/i);
    expect(JSON.parse(runTool(s, "deploy_services", {})).error).toMatch(/before deploying/i);
    expect(s.config.templates).toEqual([]);
  });
  it("validates the profile, then deploys the recommended services", () => {
    const s = fresh();
    expect(JSON.parse(runTool(s, "set_business_profile", { industry: "Spaceships" })).error).toBeDefined();
    runTool(s, "set_business_profile", { name: "Acme", industry: "Construction & trades", team_size: "2-5 people" });
    const out = JSON.parse(runTool(s, "deploy_services", {}));
    expect(out.deployed).toBe(true);
    expect(s.config.completedOn).toBe("2026-01-15");
    expect(s.config.modules).toContain("licenses");
    expect(s.links.length).toBeGreaterThan(0);
  });
  it("only accepts live industries, while every industry stays built", () => {
    const s = fresh();
    expect(JSON.parse(runTool(s, "set_business_profile", { industry: "Real estate" })).error).toBeDefined();
    expect(LIVE_INDUSTRIES).toEqual(["Construction & trades"]);
    expect(selectableIndustries("Real estate")).toEqual(["Construction & trades", "Real estate"]);
    expect(selectableIndustries("")).toEqual(["Construction & trades"]);
    expect(INDUSTRIES.every((i) => i in PRESETS)).toBe(true);
  });
  it("ignores unknown service ids and tools", () => {
    const s = fresh();
    runTool(s, "set_business_profile", { name: "Acme", industry: "Construction & trades", team_size: "Just me" });
    runTool(s, "deploy_services", { module_ids: ["documents", "nope"] });
    expect(s.config.modules).toEqual(["documents"]);
    expect(JSON.parse(runTool(s, "rm_rf", {})).error).toBeDefined();
  });
});
