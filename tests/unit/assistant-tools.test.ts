import { describe, expect, it } from "vitest";
import { runTool, type ToolState } from "@/lib/assistant/tools";
import { emptyConfig } from "@/lib/setup/types";

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
    runTool(s, "set_business_profile", { name: "Acme", industry: "Real estate", team_size: "2-5 people" });
    const out = JSON.parse(runTool(s, "deploy_services", {}));
    expect(out.deployed).toBe(true);
    expect(s.config.completedOn).toBe("2026-01-15");
    expect(s.config.modules).toContain("crm");
    expect(s.links.length).toBeGreaterThan(0);
  });
  it("ignores unknown service ids and tools", () => {
    const s = fresh();
    runTool(s, "set_business_profile", { name: "Acme", industry: "Other", team_size: "Just me" });
    runTool(s, "deploy_services", { module_ids: ["documents", "nope"] });
    expect(s.config.modules).toEqual(["documents"]);
    expect(JSON.parse(runTool(s, "rm_rf", {})).error).toBeDefined();
  });
});
