import { describe, expect, it } from "vitest";
import { greeting, respond } from "@/lib/assistant/engine";
import { emptyConfig, type SetupConfig } from "@/lib/setup/types";

const run = (input: string, config: SetupConfig = emptyConfig()) => respond(config, input);

describe("assistant", () => {
  it("greets by name and says setup is manual", () => {
    expect(greeting(emptyConfig()).text).toContain("Settings");
    expect(greeting({ ...emptyConfig(), business: { name: "Acme", industry: "Other", teamSize: "Just me" } }).text).toContain("Acme");
  });
  it("never sets anything up: a setup request points to Settings and leaves the config alone", () => {
    const config = emptyConfig();
    for (const input of ["set up", "set up my business", "deploy it", "install the templates"]) {
      const r = run(input, config);
      expect(r.config).toBe(config);
      expect(r.turns.at(-1)?.text).toContain("done by you in Settings");
      expect(r.turns.at(-1)?.links?.[0].href).toBe("/app/setup?tab=setup");
    }
  });
  it("reports what is left, read-only, and falls back to help", () => {
    const empty = run("status");
    expect(empty.turns.at(-1)?.text).toContain("Nothing is set up");
    expect(empty.config.templates).toEqual([]);
    expect(run("blah").turns.at(-1)?.text).toContain("I do not set up your account");
  });
  it("answers plain requests by rule, and leaves open questions for the AI model", () => {
    for (const input of ["help", "What can you do?", "What is left to do?", "status", "set up my business", "new invoice", "add a contact"]) expect(run(input).matched, input).toBe(true);
    for (const input of ["How do I set up recurring invoices?", "Why was this license flagged?", "Can you explain what a certificate of insurance is?", "blah"]) expect(run(input).matched, input).toBe(false);
  });
});
