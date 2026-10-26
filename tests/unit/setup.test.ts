import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "@/lib/dates";
import { routineFormSchema } from "@/lib/admin/validation";
import { validateSubmission } from "@/lib/forms/logic";
import { formBuilderSchema } from "@/lib/forms/validation";
import { MODULES } from "@/lib/modules/registry";
import { AVAILABLE_MODULE_IDS, IMPORTABLE, canFinish, recommendModules, runSetupChecks, sanitizeConfig, setupScore } from "@/lib/setup/logic";
import { parseStored } from "@/lib/setup/storage";
import { TEMPLATES, installedForms, installedLicenses, installedRoutines, templatesFor } from "@/lib/setup/templates";
import { emptyConfig, type SetupConfig } from "@/lib/setup/types";

const TODAY = "2026-10-25";
const config = (over: Partial<SetupConfig> = {}): SetupConfig => ({
  ...emptyConfig(), business: { name: "Acme Studio", industry: "Professional services", teamSize: "2-5 people" }, ...over,
});

describe("recommendModules", () => {
  const ids = (industry: Parameters<typeof recommendModules>[0], size: Parameters<typeof recommendModules>[1] = "") => recommendModules(industry, size).map((r) => r.id);
  it("always starts with documents, invoices and admin support", () => {
    expect(ids("")).toEqual(["documents", "invoices", "admin"]);
    expect(ids("Other").slice(0, 3)).toEqual(["documents", "invoices", "admin"]);
  });
  it("adds modules for the industry", () => {
    expect(ids("Construction & trades")).toEqual(["documents", "invoices", "admin", "licenses", "vendors", "projects", "forms"]);
    expect(ids("Nonprofit")).toContain("crm");
    expect(ids("Restaurant & hospitality")).toContain("reporting");
  });
  it("gives bigger teams forms for approvals, once", () => {
    expect(ids("Other")).not.toContain("forms");
    expect(ids("Other", "6-20 people")).toContain("forms");
    expect(ids("Professional services", "21+ people").filter((x) => x === "forms")).toHaveLength(1);
    expect(ids("Other", "Just me")).not.toContain("forms");
  });
  it("only recommends modules that exist and gives every one a reason", () => {
    for (const industry of ["", "Professional services", "Retail & e-commerce", "Construction & trades", "Healthcare practice", "Restaurant & hospitality", "Nonprofit", "Real estate", "Other"] as const) {
      const recs = recommendModules(industry, "21+ people");
      expect(new Set(recs.map((r) => r.id)).size).toBe(recs.length);
      for (const r of recs) {
        expect(AVAILABLE_MODULE_IDS).toContain(r.id);
        expect(r.reason.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("the template catalogue", () => {
  it("has unique ids and points at real, available modules", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) expect(AVAILABLE_MODULE_IDS).toContain(t.module);
  });
  it("only offers templates the destination module can read", () => {
    const kinds: Record<string, string> = { forms: "form", admin: "routine", licenses: "license" };
    for (const t of TEMPLATES) expect(t.kind).toBe(kinds[t.module]);
  });
  it("installs valid forms: they pass the form builder's own rules and accept a good submission", () => {
    const forms = installedForms(TEMPLATES.map((t) => t.id));
    expect(forms.length).toBe(templatesFor("forms").length);
    for (const form of forms) {
      expect(form.id.startsWith("tpl-")).toBe(true);
      const parsed = formBuilderSchema.safeParse({ ...form, fields: form.fields });
      expect(parsed.success, `${form.name}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      expect(new Set(form.fields.map((f) => f.id)).size).toBe(form.fields.length);
      const values = Object.fromEntries(form.fields.map((f) => [f.id,
        f.type === "checkbox" ? "true" : f.type === "email" ? "a@b.co" : f.type === "number" ? "5" : f.type === "date" ? "2026-11-02" : f.type === "select" ? f.options[0] : "x"]));
      expect(validateSubmission(form, values)).toEqual({});
      // Every {{placeholder}} in the document template names a real field.
      for (const [, label] of form.documentTemplate.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        expect(form.fields.some((f) => f.label.toLowerCase() === label.toLowerCase()), `${form.name}: {{${label}}}`).toBe(true);
      }
    }
  });
  it("installs valid routines that start in the future", () => {
    const routines = installedRoutines(TEMPLATES.map((t) => t.id), TODAY);
    expect(routines).toHaveLength(templatesFor("admin").length);
    for (const r of routines) {
      expect(routineFormSchema.safeParse(r).success, r.title).toBe(true);
      expect(r.nextDueOn > TODAY).toBe(true);
    }
    expect(routines.find((r) => r.id === "tpl-routine-team-agenda")!.nextDueOn).toBe(addDays(TODAY, 3));
  });
  it("installs starter licenses with a term, reminders and a checklist", () => {
    const licenses = installedLicenses(["licenses-small-business"], TODAY);
    expect(licenses).toHaveLength(4);
    expect(licenses[0]).toMatchObject({ id: "tpl-licenses-small-business-1", name: "State business license", expiresOn: addMonths(TODAY, 12), stage: "not_started" });
    expect(licenses[1].expiresOn).toBe(addMonths(TODAY, 24));
    expect(new Set(licenses.map((l) => l.id)).size).toBe(4);
    for (const l of licenses) { expect(l.requiredDocuments.length).toBeGreaterThan(0); expect(l.notes).toContain("Starter record"); }
  });
  it("installs only what was asked for, ignoring unknown ids", () => {
    expect(installedForms(["form-client-intake", "nope"]).map((f) => f.name)).toEqual(["New client intake"]);
    expect(installedForms([])).toEqual([]);
    expect(installedRoutines(["form-client-intake"], TODAY)).toEqual([]);
    expect(installedLicenses([], TODAY)).toEqual([]);
  });
});

describe("sanitizeConfig", () => {
  it("round-trips a good config", () => {
    const good = config({ step: 3, modules: ["forms", "admin"], templates: ["form-client-intake", "routine-team-agenda"], importsDone: ["admin"], completedOn: TODAY });
    expect(sanitizeConfig(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });
  it.each([null, undefined, 5, "x", [], {}, { version: 2 }, { version: "1" }])("rejects %j", (raw) => expect(sanitizeConfig(raw)).toBeNull());
  it("drops unknown and repeated ids, clamps numbers and cuts long text", () => {
    const c = sanitizeConfig({
      version: 1, step: 99, business: { name: "x".repeat(500), industry: "Hacking", teamSize: 7 },
      modules: ["forms", "forms", "setup", "__proto__", 5, "admin"], templates: ["form-client-intake", "<script>", 3], importsDone: ["crm", "nope"], completedOn: "tomorrow",
    })!;
    expect(c.step).toBe(4);
    expect(c.business).toEqual({ name: "x".repeat(80), industry: "", teamSize: "" });
    expect(c.modules).toEqual(["forms", "admin"]);
    expect(c.templates).toEqual(["form-client-intake"]);
    expect(c.importsDone).toEqual(["crm"]);
    expect(c.completedOn).toBeNull();
    expect(sanitizeConfig({ version: 1, step: -3 })!.step).toBe(0);
    expect(sanitizeConfig({ version: 1, step: 1.5 })!.step).toBe(0);
    expect(Object.keys(c).sort()).toEqual(Object.keys(emptyConfig()).sort()); // nothing extra survives
  });
  it("limits the list sizes", () => {
    const many = Array.from({ length: 100 }, () => "forms");
    expect(sanitizeConfig({ version: 1, modules: many })!.modules).toEqual(["forms"]);
  });
  it("parses stored text and survives garbage", () => {
    expect(parseStored("")).toBeNull();
    expect(parseStored("{not json")).toBeNull();
    expect(parseStored("null")).toBeNull();
    expect(parseStored(JSON.stringify(config({ modules: ["crm"] })))!.modules).toEqual(["crm"]);
  });
});

describe("runSetupChecks", () => {
  const byId = (c: SetupConfig) => Object.fromEntries(runSetupChecks(c).map((x) => [x.id, x]));
  it("fails an empty setup and says where to fix it", () => {
    const checks = byId(emptyConfig());
    expect(checks.profile).toMatchObject({ status: "fail", step: 0 });
    expect(checks.modules).toMatchObject({ status: "fail", step: 1 });
    expect(canFinish(runSetupChecks(emptyConfig()))).toBe(false);
  });
  it("needs a name, an industry and a team size", () => {
    for (const business of [
      { name: "A", industry: "Other", teamSize: "Just me" }, { name: "Acme", industry: "", teamSize: "Just me" }, { name: "Acme", industry: "Other", teamSize: "" },
    ] as const) expect(byId(config({ business: { ...business }, modules: ["crm"] })).profile.status).toBe("fail");
    expect(byId(config({ modules: ["crm"] })).profile.status).toBe("pass");
  });
  it("warns about modules with no template installed, and passes once one is", () => {
    expect(byId(config({ modules: ["forms"] }))["templates-forms"].status).toBe("warn");
    const c = byId(config({ modules: ["forms"], templates: ["form-client-intake"] }));
    expect(c["templates-forms"]).toMatchObject({ status: "pass", detail: "1 of 3 installed." });
    expect(byId(config({ modules: ["crm"] }))["templates-crm"]).toBeUndefined(); // CRM has no templates to install
  });
  it("wants a recurring task when Admin Support is on", () => {
    expect(byId(config({ modules: ["admin"] })).recurring.status).toBe("warn");
    expect(byId(config({ modules: ["admin"], templates: ["routine-team-agenda"] })).recurring.status).toBe("pass");
    expect(byId(config({ modules: ["crm"] })).recurring).toBeUndefined();
  });
  it("suggests the modules that go together", () => {
    expect(byId(config({ modules: ["vendors"] }))["vendors-forms"].status).toBe("warn");
    expect(byId(config({ modules: ["vendors", "forms"] }))["vendors-forms"]).toBeUndefined();
    expect(byId(config({ modules: ["invoices"] }))["invoices-crm"].status).toBe("warn");
    expect(byId(config({ modules: ["invoices", "crm"] }))["invoices-crm"]).toBeUndefined();
    expect(byId(config({ modules: ["licenses"] }))["licenses-admin"].status).toBe("warn");
  });
  it("asks about existing data for each module that has some, and accepts it as done", () => {
    expect(byId(config({ modules: ["crm"] }))["data-crm"]).toMatchObject({ status: "warn", step: 3, detail: IMPORTABLE.crm });
    expect(byId(config({ modules: ["crm"], importsDone: ["crm"] }))["data-crm"].status).toBe("pass");
    expect(byId(config({ modules: ["admin"] }))["data-admin"]).toBeUndefined();
  });
  it("scores the share of passing checks and lets a warning-only setup finish", () => {
    expect(setupScore([])).toBe(0);
    const checks = runSetupChecks(config({ modules: ["crm", "forms"], templates: ["form-client-intake"] })); // CRM data still to import
    expect(canFinish(checks)).toBe(true);
    expect(checks.every((c) => c.status === "pass")).toBe(false);
    const full = runSetupChecks(config({ modules: ["crm"], importsDone: ["crm"] }));
    expect(full.every((c) => c.status === "pass")).toBe(true);
    expect(setupScore(full)).toBe(100);
    expect(setupScore(checks)).toBeLessThan(100);
  });
  it("only refers to modules that exist", () => {
    const ids = new Set(MODULES.map((m) => m.id));
    for (const m of AVAILABLE_MODULE_IDS) expect(ids.has(m)).toBe(true);
    expect(AVAILABLE_MODULE_IDS).not.toContain("setup");
    expect(AVAILABLE_MODULE_IDS).toHaveLength(10);
  });
});
