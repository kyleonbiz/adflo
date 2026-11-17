import { MODULES } from "@/lib/modules/registry";
import { TEMPLATE_IDS, templatesFor } from "./templates";
import { INDUSTRIES, TEAM_SIZES, emptyConfig, type Industry, type SetupCheck, type SetupConfig, type TeamSize } from "./types";

export interface Recommendation { id: string; reason: string }

const BASE: Recommendation[] = [
  { id: "documents", reason: "Keep every file in one searchable place." },
  { id: "invoices", reason: "Track what you are owed and chase late payments." },
];

const BY_INDUSTRY: Record<Industry, Recommendation[]> = {
  "Property management": [
    { id: "vendors", reason: "Maintenance vendors need insurance certificates and W-9s on file." },
    { id: "forms", reason: "Maintenance requests, move-in checklists and applications." },
    { id: "crm", reason: "Owners, tenants and prospects in one clean list." },
    { id: "licenses", reason: "Broker licenses, rental registrations and insurance renew." },
    { id: "projects", reason: "Unit turnovers and renovations have tasks and deadlines." },
  ],
  "Construction & trades": [
    { id: "licenses", reason: "Trade licenses, bonds and insurance must stay current." },
    { id: "vendors", reason: "Subcontractors need insurance certificates on file." },
    { id: "projects", reason: "Jobs have tasks and deadlines." },
    { id: "forms", reason: "Change orders and job forms." },
  ],
  "Home services": [
    { id: "licenses", reason: "Contractor licenses, bonds and insurance must stay current." },
    { id: "projects", reason: "Every job has steps and a finish date." },
    { id: "vendors", reason: "Subcontractors and suppliers." },
    { id: "crm", reason: "Customers and repeat clients." },
  ],
  Other: [
    { id: "crm", reason: "Keep your contacts in one clean list." },
    { id: "projects", reason: "Plan work with tasks and deadlines." },
  ],
};

/** Which modules to suggest, with a reason each. Bigger teams also get forms, for standard paperwork. */
export function recommendModules(industry: Industry | "", teamSize: TeamSize | ""): Recommendation[] {
  const list = [...BASE, ...(industry ? BY_INDUSTRY[industry] : [])];
  if ((teamSize === "6-20 people" || teamSize === "21+ people") && !list.some((r) => r.id === "forms")) {
    list.push({ id: "forms", reason: "A bigger team needs standard paperwork." });
  }
  const seen = new Set<string>();
  return list.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

export const AVAILABLE_MODULE_IDS = MODULES.filter((m) => m.status === "available" && m.id !== "setup" && !m.hidden).map((m) => m.id);

/** Modules that have existing data worth bringing in, and where to do it. */
export const IMPORTABLE: Record<string, string> = {
  crm: "Import your contact list (CSV).",
  reporting: "Import a spreadsheet to clean and report on.",
  documents: "Upload your existing files.",
  invoices: "Add your open invoices.",
  vendors: "Add your current suppliers.",
  licenses: "Enter your current licenses and expiry dates.",
};

/** Drops anything unknown or repeated, so a stale or edited saved config can never break the wizard. */
export function sanitizeConfig(raw: unknown): SetupConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  const strings = (v: unknown, allowed: ReadonlySet<string>, max: number) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.has(x)))].slice(0, max) : [];
  const b = (r.business ?? {}) as Record<string, unknown>;
  const modules = new Set(AVAILABLE_MODULE_IDS);
  const config: SetupConfig = {
    ...emptyConfig(),
    step: typeof r.step === "number" && Number.isInteger(r.step) ? Math.min(4, Math.max(0, r.step)) : 0,
    business: {
      name: typeof b.name === "string" ? b.name.slice(0, 80) : "",
      industry: (INDUSTRIES as readonly unknown[]).includes(b.industry) ? (b.industry as Industry) : "",
      teamSize: (TEAM_SIZES as readonly unknown[]).includes(b.teamSize) ? (b.teamSize as TeamSize) : "",
    },
    modules: strings(r.modules, modules, 20),
    templates: strings(r.templates, TEMPLATE_IDS, 60),
    importsDone: strings(r.importsDone, modules, 20),
    completedOn: typeof r.completedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.completedOn) ? r.completedOn : null,
  };
  return config;
}

const nameOf = (id: string) => MODULES.find((m) => m.id === id)?.name ?? id;

/** The automated setup checks. "fail" blocks finishing; "warn" is advice. */
export function runSetupChecks(c: SetupConfig): SetupCheck[] {
  const checks: SetupCheck[] = [];
  const has = (id: string) => c.modules.includes(id);

  const named = c.business.name.trim().length >= 2;
  checks.push(
    named && c.business.industry && c.business.teamSize
      ? { id: "profile", status: "pass", title: "Business profile", detail: `${c.business.name.trim()}, ${c.business.industry}, ${c.business.teamSize}.`, step: 0 }
      : { id: "profile", status: "fail", title: "Business profile", detail: "Add your business name, industry and team size.", step: 0 },
  );

  checks.push(
    c.modules.length > 0
      ? { id: "modules", status: "pass", title: "Services chosen", detail: `${c.modules.length} selected: ${c.modules.map(nameOf).join(", ")}.`, step: 1 }
      : { id: "modules", status: "fail", title: "Services chosen", detail: "Pick at least one service.", step: 1 },
  );

  for (const id of c.modules) {
    const options = templatesFor(id);
    if (options.length === 0) continue;
    const installed = options.filter((t) => c.templates.includes(t.id)).length;
    checks.push(
      installed > 0
        ? { id: `templates-${id}`, status: "pass", title: `${nameOf(id)} templates`, detail: `${installed} of ${options.length} installed.`, step: 2 }
        : { id: `templates-${id}`, status: "warn", title: `${nameOf(id)} templates`, detail: `None installed yet. ${options.length} available.`, step: 2 },
    );
  }

  if (has("vendors") && !has("forms")) {
    checks.push({ id: "vendors-forms", status: "warn", title: "Vendor intake", detail: "Vendors work best with Forms & Paperwork for intake.", step: 1 });
  }
  if (has("invoices") && !has("crm")) {
    checks.push({ id: "invoices-crm", status: "warn", title: "Client contacts", detail: "Add Contacts to keep the contacts behind your invoices clean.", step: 1 });
  }
  for (const id of c.modules) {
    if (!IMPORTABLE[id]) continue;
    checks.push(
      c.importsDone.includes(id)
        ? { id: `data-${id}`, status: "pass", title: `${nameOf(id)} data`, detail: "Marked as done.", step: 3 }
        : { id: `data-${id}`, status: "warn", title: `${nameOf(id)} data`, detail: IMPORTABLE[id], step: 3 },
    );
  }
  return checks;
}

export function setupScore(checks: SetupCheck[]): number {
  return checks.length === 0 ? 0 : Math.round((checks.filter((x) => x.status === "pass").length / checks.length) * 100);
}

export const canFinish = (checks: SetupCheck[]) => checks.every((x) => x.status !== "fail");
