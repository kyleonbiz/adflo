import type { ChainConfig } from "@/lib/approvals/chain";
import type { FormTemplate } from "@/lib/forms/types";
import { PAPERWORK, type IndustryId as PaperworkType, type Paperwork } from "@/lib/forms/paperwork";
import { LICENSE_TEMPLATES, type BusinessTypeId, type LicenseTemplate } from "@/lib/licenses/templates";
import type { License } from "@/lib/licenses/types";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "@/lib/projects/templates";
import { addMonths } from "@/lib/dates";
import { MODULES } from "@/lib/modules/registry";
import { recommendModules } from "./logic";
import { BUNDLE_ID_LIST } from "./templates";
import type { Industry, SetupConfig } from "./types";

/**
 * What choosing an industry sets up. Every row says which template library to draw from and the few
 * numbers and names that differ; the libraries themselves live with their services. Change a row here
 * to change what that industry gets (the choices are listed in NOTES.md).
 */
export interface IndustryPreset {
  /** Which licenses library to draw from. */
  licenses: BusinessTypeId;
  /** Which paperwork library to draw from. */
  paperwork: PaperworkType;
  /** Documents every new vendor owes, on top of the standard ones for its category. */
  vendorDocs: string[];
  /** Who signs off, in order. Empty means the standard single approver. */
  chains: ChainConfig;
  /** Days before a due date that reminders start. */
  leadDays: 7 | 14 | 30 | 60;
}

const chain = (requests: string[], forms: string[] = []): ChainConfig => ({ requests, forms });
const two = (a: string, b: string) => chain([a, b]);

export const PRESETS: Record<Industry, IndustryPreset> = {
  "Professional services": { licenses: "professional", paperwork: "professional", vendorDocs: ["Signed contract"], chains: chain(["Office manager"]), leadDays: 30 },
  "Retail & e-commerce": { licenses: "retail", paperwork: "retail", vendorDocs: ["Resale certificate"], chains: chain(["Store manager"]), leadDays: 30 },
  "Construction & trades": { licenses: "construction", paperwork: "construction", vendorDocs: ["Workers' compensation certificate", "Lien waiver"], chains: two("Project manager", "Owner"), leadDays: 30 },
  "Healthcare practice": { licenses: "health", paperwork: "health", vendorDocs: ["Business associate agreement"], chains: two("Practice manager", "Owner"), leadDays: 60 },
  "Restaurant & hospitality": { licenses: "food", paperwork: "food", vendorDocs: ["Food safety certificate"], chains: chain(["General manager"]), leadDays: 60 },
  Nonprofit: { licenses: "general", paperwork: "general", vendorDocs: [], chains: two("Program director", "Treasurer"), leadDays: 30 },
  "Real estate": { licenses: "realestate", paperwork: "realestate", vendorDocs: ["Signed contract"], chains: chain(["Managing broker"]), leadDays: 60 },
  "Auto & fleet": { licenses: "vehicle", paperwork: "vehicle", vendorDocs: ["Garage liability certificate"], chains: two("Fleet manager", "Owner"), leadDays: 30 },
  "Home services": { licenses: "construction", paperwork: "construction", vendorDocs: ["Workers' compensation certificate"], chains: two("Office manager", "Owner"), leadDays: 30 },
  "Beauty & wellness": { licenses: "beauty", paperwork: "beauty", vendorDocs: ["Product safety data sheet"], chains: chain(["Owner"]), leadDays: 30 },
  Legal: { licenses: "legal", paperwork: "legal", vendorDocs: ["Confidentiality agreement"], chains: { requests: ["Office manager", "Managing partner"], forms: ["Managing partner"] }, leadDays: 60 },
  "Accounting & tax": { licenses: "accounting", paperwork: "accounting", vendorDocs: ["Confidentiality agreement"], chains: two("Office manager", "Partner"), leadDays: 60 },
  "Trucking & logistics": { licenses: "vehicle", paperwork: "vehicle", vendorDocs: ["Operating authority (MC number)", "Driver list"], chains: two("Dispatch manager", "Owner"), leadDays: 60 },
  "Education & childcare": { licenses: "childcare", paperwork: "childcare", vendorDocs: ["Background check confirmation"], chains: two("Director", "Owner"), leadDays: 60 },
  Manufacturing: { licenses: "manufacturing", paperwork: "manufacturing", vendorDocs: ["Quality certification", "Safety data sheets"], chains: two("Plant manager", "Finance manager"), leadDays: 60 },
  "Tech & agency": { licenses: "professional", paperwork: "professional", vendorDocs: ["Master services agreement", "Security questionnaire"], chains: chain(["Operations lead"]), leadDays: 30 },
  Other: { licenses: "general", paperwork: "general", vendorDocs: [], chains: chain(["Operations manager"]), leadDays: 30 },
};

/** The pieces setup can bundle for an industry. Each is one tick box; the setup config remembers which are on. */
export const BUNDLES = [
  { id: "bundle:licenses", label: "License and renewal records", needs: "licenses" },
  { id: "bundle:paperwork", label: "Paperwork and forms", needs: "forms" },
  { id: "bundle:projects", label: "Project templates", needs: "projects" },
  { id: "bundle:vendor-docs", label: "Documents every vendor owes", needs: "vendors" },
  { id: "bundle:approvals", label: "Approval chain", needs: "admin" },
  { id: "bundle:reminders", label: "Reminder lead time", needs: "licenses" },
  { id: "bundle:home", label: "Dashboard starting points", needs: "" },
] as const;
export type BundleId = (typeof BUNDLE_ID_LIST)[number];

/** Bundles that make sense for the services chosen. */
export const bundlesFor = (modules: readonly string[]) => BUNDLES.filter((b) => !b.needs || modules.includes(b.needs) || (b.id === "bundle:approvals" && modules.includes("forms")));

const GENERAL_LICENSES = ["gen-business-license", "gen-general-liability"];

export function licensesFor(industry: Industry): LicenseTemplate[] {
  const own = LICENSE_TEMPLATES.filter((l) => l.businessType === PRESETS[industry].licenses);
  const base = LICENSE_TEMPLATES.filter((l) => GENERAL_LICENSES.includes(l.id) && !own.some((o) => o.name === l.name));
  return PRESETS[industry].licenses === "general" ? own.filter((l) => !l.id.includes("privacy")) : [...base, ...own];
}

export const paperworkFor = (industry: Industry): Paperwork[] => PAPERWORK.filter((p) => p.industry === PRESETS[industry].paperwork);

export function projectsFor(industry: Industry): ProjectTemplate[] {
  const fit = PROJECT_TEMPLATES.filter((t) => t.bestFor?.includes(industry));
  return fit.length > 0 ? fit : PROJECT_TEMPLATES.filter((t) => !t.bestFor).slice(0, 2);
}

const BASE_IDS = ["documents", "invoices", "admin"];
/** The service ids the home screen suggests first: the ones this industry leans on, then the everyday ones. */
export function beginIdsFor(industry: Industry): string[] {
  const own = recommendModules(industry, "").map((r) => r.id).filter((id) => !BASE_IDS.includes(id));
  return [...own, "invoices", "admin"].filter((id, i, a) => a.indexOf(id) === i).slice(0, 6);
}

/** Everything a bundle puts in place, in words, for the "what we'll set up" list. */
export function describeBundle(id: BundleId, industry: Industry): { count: number; items: string[] } {
  switch (id) {
    case "bundle:licenses": { const l = licensesFor(industry); return { count: l.length, items: l.map((x) => x.name) }; }
    case "bundle:paperwork": { const p = paperworkFor(industry); return { count: p.length, items: p.map((x) => x.form.name) }; }
    case "bundle:projects": { const p = projectsFor(industry); return { count: p.length, items: p.map((x) => x.name) }; }
    case "bundle:vendor-docs": { const d = PRESETS[industry].vendorDocs; return { count: d.length, items: d.length ? d : ["Nothing extra for this industry"] }; }
    case "bundle:approvals": { const c = PRESETS[industry].chains; return { count: c.requests.length, items: [`Requests: ${c.requests.join(" then ")}`, ...(c.forms.length ? [`Forms: ${c.forms.join(" then ")}`] : [])] }; }
    case "bundle:reminders": return { count: 1, items: [`Start reminders ${PRESETS[industry].leadDays} days ahead`] };
    case "bundle:home": { const ids = beginIdsFor(industry); return { count: ids.length, items: ids.map((i) => MODULES.find((m) => m.id === i)?.name ?? i) }; }
  }
}

/** Which bundles to tick by default when a business first reaches the templates step. */
export const defaultBundles = (modules: readonly string[]): string[] => bundlesFor(modules).map((b) => b.id);

// ---- what a finished setup puts in each service

const on = (c: SetupConfig | null, id: BundleId): c is SetupConfig & { business: { industry: Industry } } =>
  !!c && c.completedOn !== null && c.business.industry !== "" && c.templates.includes(id);

/** License records for the industry, expiring a term from today. They are starting points: the notes ask for the real numbers and dates. */
export function industryLicenses(c: SetupConfig | null, today: string): License[] {
  if (!on(c, "bundle:licenses")) return [];
  return licensesFor(c.business.industry).map((t): License => ({
    id: `ind-${t.id}`, name: t.name, category: t.category, issuer: t.issuer, number: "", holder: "",
    issuedOn: today, expiresOn: addMonths(today, t.termMonths), renewalTermMonths: t.termMonths, reminderDays: t.reminderDays,
    stage: "not_started", notes: "Starter record: enter the real license number and dates.",
    requiredDocuments: t.documents.map((label, j) => ({ id: `ind-${t.id}-d${j + 1}`, label, received: false })),
  }));
}

export function industryForms(c: SetupConfig | null): FormTemplate[] {
  return on(c, "bundle:paperwork") ? paperworkFor(c.business.industry).map((p) => p.form) : [];
}

export const industryVendorDocs = (c: SetupConfig | null): string[] => (on(c, "bundle:vendor-docs") ? PRESETS[c.business.industry].vendorDocs : []);

/** The approval chains the industry suggests, used wherever none has been set by hand. */
export function industryChains(c: SetupConfig | null): ChainConfig {
  return on(c, "bundle:approvals") ? PRESETS[c.business.industry].chains : { requests: [], forms: [] };
}

export const industryProjects = (c: SetupConfig | null): ProjectTemplate[] => (on(c, "bundle:projects") ? projectsFor(c.business.industry) : []);

/** Service ids for the home screen's "where to begin" cards, or null to use the default set. */
export function industryBegin(c: SetupConfig | null): string[] | null {
  return on(c, "bundle:home") ? beginIdsFor(c.business.industry) : null;
}

export const industryLeadDays = (c: SetupConfig | null): IndustryPreset["leadDays"] | null => (on(c, "bundle:reminders") ? PRESETS[c.business.industry].leadDays : null);
