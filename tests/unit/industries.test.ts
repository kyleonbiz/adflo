import { describe, expect, it } from "vitest";
import { BUNDLES, PRESETS, beginIdsFor, bundlesFor, defaultBundles, describeBundle, industryBegin, industryChains, industryForms, industryLeadDays, industryLicenses, industryProjects, industryVendorDocs, licensesFor, paperworkFor, projectsFor } from "@/lib/setup/industries";
import { AVAILABLE_MODULE_IDS, recommendModules, sanitizeConfig } from "@/lib/setup/logic";
import { INDUSTRIES, emptyConfig, type Industry, type SetupConfig } from "@/lib/setup/types";

const T = "2026-10-26";
const done = (industry: Industry, extra: string[] = defaultBundles(AVAILABLE_MODULE_IDS)): SetupConfig => ({
  ...emptyConfig(), business: { name: "Acme", industry, teamSize: "2-5 people" }, modules: AVAILABLE_MODULE_IDS, templates: extra, completedOn: T,
});

describe("industry presets", () => {
  it("offers the wider list of industries and gives every one a preset, recommendations and real library content", () => {
    expect(INDUSTRIES).toEqual(expect.arrayContaining(["Auto & fleet", "Home services", "Beauty & wellness", "Legal", "Accounting & tax", "Trucking & logistics", "Education & childcare", "Manufacturing", "Tech & agency"]));
    for (const i of INDUSTRIES) {
      expect(PRESETS[i]).toBeDefined();
      expect(recommendModules(i, "2-5 people").length).toBeGreaterThan(3);
      expect(licensesFor(i).length, `${i} licenses`).toBeGreaterThan(1);
      expect(paperworkFor(i).length, `${i} paperwork`).toBeGreaterThan(1);
      expect(projectsFor(i).length, `${i} projects`).toBeGreaterThan(0);
      expect(PRESETS[i].chains.requests.length).toBeGreaterThan(0);
      expect(beginIdsFor(i).length).toBeGreaterThan(2);
      for (const b of BUNDLES) expect(describeBundle(b.id, i).items.length).toBeGreaterThan(0);
    }
  });

  it("suits each industry: vehicle items for fleets and trucking, bar and CLE for legal, a childcare license for childcare", () => {
    expect(licensesFor("Auto & fleet").map((l) => l.name.toLowerCase()).join("|")).toContain("registration");
    expect(licensesFor("Trucking & logistics").map((l) => l.name)).toContain("USDOT number / motor carrier registration");
    expect(licensesFor("Legal").map((l) => l.name)).toEqual(expect.arrayContaining(["Bar admission", "Continuing legal education hours"]));
    expect(licensesFor("Education & childcare").map((l) => l.name)).toContain("Child care facility license");
    expect(projectsFor("Construction & trades").map((p) => p.id)).toContain("job-closeout");
    expect(projectsFor("Accounting & tax").map((p) => p.id)).toContain("tax-season");
  });

  it("puts nothing in place until setup is finished and the bundle is ticked", () => {
    const unfinished = { ...done("Legal"), completedOn: null };
    expect(industryLicenses(unfinished, T)).toEqual([]);
    expect(industryForms(unfinished)).toEqual([]);
    expect(industryLicenses(null, T)).toEqual([]);
    const off = done("Legal", []);
    expect(industryLicenses(off, T)).toEqual([]);
    expect(industryChains(off)).toEqual({ requests: [], forms: [] });
    expect(industryBegin(off)).toBeNull();
    expect(industryLeadDays(off)).toBeNull();
  });

  it("installs the licenses, forms, vendor documents, chain, project templates, home cards and lead time when ticked", () => {
    const c = done("Construction & trades");
    const licenses = industryLicenses(c, T);
    expect(licenses.length).toBe(licensesFor("Construction & trades").length);
    expect(new Set(licenses.map((l) => l.id)).size).toBe(licenses.length);
    expect(licenses.every((l) => l.expiresOn > T && l.requiredDocuments.length > 0)).toBe(true);
    expect(industryForms(c).map((f) => f.name)).toContain("Change order");
    expect(industryVendorDocs(c)).toContain("Workers' compensation certificate");
    expect(industryChains(c).requests).toEqual(["Project manager", "Owner"]);
    expect(industryProjects(c).map((p) => p.id)).toContain("job-closeout");
    expect(industryBegin(c)?.[0]).toBe("licenses");
    expect(industryLeadDays(c)).toBe(30);
    expect(industryLeadDays(done("Healthcare practice"))).toBe(60);
  });

  it("follows a change of industry, because the bundles are derived from it", () => {
    const before = done("Legal");
    const after = { ...before, business: { ...before.business, industry: "Auto & fleet" as Industry } };
    expect(industryForms(after).map((f) => f.name)).not.toEqual(industryForms(before).map((f) => f.name));
    expect(industryChains(after).requests).toEqual(["Fleet manager", "Owner"]);
  });

  it("only offers bundles for services that are on, and keeps bundle ids through a save and load", () => {
    expect(bundlesFor(["invoices"]).map((b) => b.id)).toEqual(["bundle:home"]);
    expect(bundlesFor(["licenses", "forms", "projects"]).map((b) => b.id)).toEqual(expect.arrayContaining(["bundle:licenses", "bundle:paperwork", "bundle:projects", "bundle:approvals", "bundle:reminders"]));
    const round = sanitizeConfig(JSON.parse(JSON.stringify(done("Legal", ["bundle:licenses", "bundle:nonsense"]))));
    expect(round?.templates).toEqual(["bundle:licenses"]);
  });
});
