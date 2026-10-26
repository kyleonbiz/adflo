import { describe, expect, it } from "vitest";
import { greeting, respond, type Pending } from "@/lib/assistant/engine";
import { emptyConfig, type SetupConfig } from "@/lib/setup/types";

const TODAY = "2026-01-15";
function run(inputs: string[], start: { config?: SetupConfig; pending?: Pending } = {}) {
  let config = start.config ?? emptyConfig();
  let pending: Pending = start.pending ?? null;
  const texts: string[] = [];
  for (const i of inputs) {
    const r = respond(config, pending, i, TODAY);
    config = r.config; pending = r.pending;
    texts.push(...r.turns.filter((t) => t.role === "assistant").map((t) => t.text));
  }
  return { config, pending, texts };
}

describe("assistant", () => {
  it("greets differently once deployed", () => {
    expect(greeting(emptyConfig()).chips).toContain("Set up my business");
    expect(greeting({ ...emptyConfig(), business: { name: "Acme", industry: "Other", teamSize: "Just me" }, completedOn: TODAY }).text).toContain("Acme is deployed");
  });
  it("walks through questions and deploys", () => {
    const r = run(["set up", "Acme Plumbing", "construction", "2-5 people", "yes"]);
    expect(r.config.business).toEqual({ name: "Acme Plumbing", industry: "Construction & trades", teamSize: "2-5 people" });
    expect(r.config.modules).toContain("licenses");
    expect(r.config.templates.length).toBeGreaterThan(0);
    expect(r.config.completedOn).toBe(TODAY);
    expect(r.pending).toBeNull();
  });
  it("re-asks on an unknown industry and leaves things alone when declined", () => {
    const r = run(["set up", "Acme", "spaceships"]);
    expect(r.pending).toBe("industry");
    const d = run(["set up", "Acme", "Other", "Just me", "not yet"]);
    expect(d.config.templates).toEqual([]);
    expect(d.config.completedOn).toBeNull();
  });
  it("reports status and falls back to help", () => {
    expect(run(["status"]).texts[0]).toContain("Nothing is set up");
    expect(run(["blah"]).texts[0]).toContain("fixed rules");
  });
});
