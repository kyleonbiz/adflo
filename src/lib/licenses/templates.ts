import { DEFAULT_DOCUMENTS, LICENSE_CATEGORIES, type LicenseCategory } from "./types";

export const BUSINESS_TYPES = [
  { id: "general", label: "Any business" },
  { id: "vehicle", label: "Vehicles and fleet" },
  { id: "food", label: "Restaurant or food service" },
  { id: "construction", label: "Construction and trades" },
  { id: "professional", label: "Professional services" },
  { id: "realestate", label: "Real estate" },
  { id: "health", label: "Healthcare" },
  { id: "retail", label: "Retail" },
  { id: "beauty", label: "Beauty and wellness" },
  { id: "childcare", label: "Education and childcare" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "legal", label: "Legal" },
  { id: "accounting", label: "Accounting and tax" },
] as const;
export type BusinessTypeId = (typeof BUSINESS_TYPES)[number]["id"];

/** A starting point for one license, certification or policy. Dates are never guessed: the user enters those from the real document. */
export interface LicenseTemplate {
  id: string;
  businessType: BusinessTypeId;
  name: string;
  category: LicenseCategory;
  issuer: string;
  termMonths: number;
  reminderDays: number[];
  documents: string[];
  notes: string;
}

const t = (
  businessType: BusinessTypeId, id: string, name: string, category: LicenseCategory, issuer: string,
  termMonths: number, documents: string[], notes = "", reminderDays: number[] = [60, 30, 7],
): LicenseTemplate => ({ id, businessType, name, category, issuer, termMonths, reminderDays, documents, notes });

export const LICENSE_TEMPLATES: readonly LicenseTemplate[] = [
  t("general", "gen-business-license", "Business license", "business", "City or county clerk", 12, ["Annual report", "Renewal fee receipt"]),
  t("general", "gen-sales-tax", "Sales tax permit", "permit", "State department of revenue", 12, ["Filed returns", "Renewal fee receipt"]),
  t("general", "gen-general-liability", "General liability insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance", "Premium receipt"]),
  t("general", "gen-workers-comp", "Workers' compensation insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance", "Payroll audit"]),
  t("general", "gen-dba", "DBA / fictitious name registration", "registration", "County clerk", 60, ["Registration certificate"]),
  t("general", "gen-privacy-policy", "Data privacy policy review", "policy", "Internal", 12, ["Reviewed policy", "Sign-off record"], "Review once a year or when your practices change.", [30, 7]),

  t("vehicle", "veh-registration", "Vehicle registration", "registration", "State motor vehicle department", 12, ["Registration card", "Renewal fee receipt"], "One record per vehicle: put the plate number in the number field."),
  t("vehicle", "veh-tags", "License plate tags / sticker", "registration", "State motor vehicle department", 12, ["New sticker photo", "Renewal fee receipt"]),
  t("vehicle", "veh-insurance", "Commercial auto insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance", "Insurance ID cards"]),
  t("vehicle", "veh-inspection", "Vehicle safety inspection", "permit", "State-approved inspection station", 12, ["Inspection report"]),
  t("vehicle", "veh-dot", "USDOT number / motor carrier registration", "registration", "Federal Motor Carrier Safety Administration", 24, ["MCS-150 update confirmation"], "", [90, 60, 30]),
  t("vehicle", "veh-cdl", "Commercial driver's license", "professional", "State motor vehicle department", 48, ["Medical examiner's certificate", "License copy"], "One record per driver.", [90, 60, 30]),

  t("food", "food-health-permit", "Health department permit", "permit", "County health department", 12, ["Inspection report", "Renewal fee receipt"]),
  t("food", "food-manager-cert", "Food protection manager certification", "certification", "ANSI-accredited provider", 60, ["Certificate copy"], "", [90, 60, 30]),
  t("food", "food-handler", "Food handler cards (staff)", "certification", "Local health department", 36, ["Cards for each employee"], "Track one record per employee, or one for the whole team."),
  t("food", "food-liquor", "Liquor license", "permit", "State alcohol beverage control", 12, ["Renewal application", "Renewal fee receipt"], "", [90, 60, 30]),
  t("food", "food-fire", "Fire marshal inspection", "permit", "Local fire department", 12, ["Inspection certificate"]),

  t("construction", "con-contractor", "Contractor license", "professional", "State contractors board", 24, ["Continuing education proof", "Renewal fee receipt"], "", [90, 60, 30]),
  t("construction", "con-bond", "Contractor surety bond", "insurance", "Surety company", 12, ["Bond certificate", "Premium receipt"]),
  t("construction", "con-workers-comp", "Workers' compensation insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance", "Payroll audit"]),
  t("construction", "con-osha", "OSHA 10/30 safety cards", "certification", "OSHA-authorized trainer", 60, ["Card copies"], "", [90, 60, 30]),
  t("construction", "con-epa-lead", "EPA lead-safe (RRP) certification", "certification", "EPA", 60, ["Certificate copy", "Refresher course proof"], "", [90, 60, 30]),
  t("construction", "con-safety-policy", "Written safety program review", "policy", "Internal", 12, ["Reviewed program", "Team sign-off"], "", [30, 7]),

  t("professional", "pro-license", "Professional license", "professional", "State licensing board", 24, ["Continuing education proof", "Renewal fee receipt"], "", [90, 60, 30]),
  t("professional", "pro-eo", "Professional liability (E&O) insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),
  t("professional", "pro-ce", "Continuing education requirement", "certification", "Licensing board", 24, ["Course completion certificates"], "", [120, 60, 30]),
  t("professional", "pro-cyber", "Cyber liability insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),

  t("realestate", "re-broker", "Real estate broker license", "professional", "State real estate commission", 24, ["Continuing education proof", "Renewal fee receipt"], "", [90, 60, 30]),
  t("realestate", "re-eo", "Errors and omissions insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),
  t("realestate", "re-trust", "Trust account reconciliation attestation", "policy", "State real estate commission", 12, ["Signed attestation"], "", [30, 7]),

  t("health", "hc-clinical", "Clinical license", "professional", "State health professions board", 24, ["Continuing education proof", "Renewal fee receipt"], "", [90, 60, 30]),
  t("health", "hc-dea", "DEA registration", "registration", "Drug Enforcement Administration", 36, ["Renewal confirmation"], "", [90, 60, 30]),
  t("health", "hc-cpr", "CPR / BLS certification", "certification", "American Heart Association or Red Cross", 24, ["Card copy"], "", [60, 30, 7]),
  t("health", "hc-hipaa", "HIPAA training and policy review", "policy", "Internal", 12, ["Training roster", "Reviewed policy"], "", [30, 7]),
  t("health", "hc-malpractice", "Malpractice insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),

  t("retail", "ret-resale", "Resale certificate", "permit", "State department of revenue", 12, ["Filed returns"]),
  t("retail", "ret-signage", "Signage permit", "permit", "City planning department", 12, ["Signed application", "Renewal fee receipt"]),
  t("retail", "ret-occupancy", "Certificate of occupancy", "permit", "City building department", 12, ["Certificate copy"]),
  t("retail", "ret-property", "Commercial property insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance", "Premium receipt"]),

  t("beauty", "bty-license", "Cosmetology or esthetics license", "professional", "State board of cosmetology", 24, ["Continuing education proof", "Renewal fee receipt"], "One record per licensed person.", [90, 60, 30]),
  t("beauty", "bty-shop", "Salon or shop license", "permit", "State board or county", 12, ["Inspection report", "Renewal fee receipt"]),
  t("beauty", "bty-sanitation", "Health and sanitation inspection", "permit", "County health department", 12, ["Inspection report"]),
  t("beauty", "bty-liability", "Professional liability insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),

  t("childcare", "cc-facility", "Child care facility license", "permit", "State human services department", 12, ["Inspection report", "Renewal application"], "", [90, 60, 30]),
  t("childcare", "cc-background", "Staff background checks", "certification", "State or FBI", 24, ["Clearance letters for each staff member"], "One record for the whole team, or one per person.", [90, 60, 30]),
  t("childcare", "cc-firstaid", "CPR and first aid cards", "certification", "American Heart Association or Red Cross", 24, ["Card copies for each staff member"], "", [60, 30, 7]),
  t("childcare", "cc-fire", "Fire inspection", "permit", "Local fire marshal", 12, ["Inspection certificate"]),
  t("childcare", "cc-liability", "Liability and abuse coverage", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),

  t("manufacturing", "mfg-environmental", "Environmental permit", "permit", "State environmental agency", 60, ["Monitoring reports", "Renewal fee receipt"], "", [180, 90, 60]),
  t("manufacturing", "mfg-fire", "Fire marshal inspection", "permit", "Local fire marshal", 12, ["Inspection certificate"]),
  t("manufacturing", "mfg-osha-log", "OSHA injury log posting", "policy", "Internal", 12, ["Posted 300A summary"], "Post from February 1 to April 30 each year.", [45, 14]),
  t("manufacturing", "mfg-forklift", "Forklift operator certifications", "certification", "Employer or training provider", 36, ["Certificates for each operator"], "", [90, 60, 30]),
  t("manufacturing", "mfg-liability", "Product liability insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance", "Premium receipt"]),

  t("legal", "lgl-bar", "Bar admission", "professional", "State bar", 12, ["Annual fee receipt", "CLE compliance proof"], "One record per attorney.", [90, 60, 30]),
  t("legal", "lgl-cle", "Continuing legal education hours", "certification", "State bar", 36, ["Course completion certificates"], "", [180, 90, 30]),
  t("legal", "lgl-trust", "Trust account reconciliation", "policy", "State bar", 12, ["Monthly reconciliations", "Signed review"], "", [30, 7]),
  t("legal", "lgl-malpractice", "Malpractice insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),

  t("accounting", "acc-cpa", "CPA license", "professional", "State board of accountancy", 24, ["CPE proof", "Renewal fee receipt"], "One record per CPA.", [90, 60, 30]),
  t("accounting", "acc-ptin", "IRS preparer tax identification number (PTIN)", "registration", "IRS", 12, ["Renewal confirmation"], "Renews every year before the filing season.", [90, 60, 30]),
  t("accounting", "acc-efile", "IRS e-file provider registration", "registration", "IRS", 12, ["Application confirmation"], "", [60, 30]),
  t("accounting", "acc-cpe", "Continuing professional education hours", "certification", "State board of accountancy", 36, ["Course completion certificates"], "", [180, 90, 30]),
  t("accounting", "acc-eo", "Professional liability (E&O) insurance", "insurance", "Insurance carrier", 12, ["Updated certificate of insurance"]),
];

/** Templates for one business type, plus the ones every business needs. */
export function templatesFor(type: BusinessTypeId): LicenseTemplate[] {
  return LICENSE_TEMPLATES.filter((l) => l.businessType === type);
}

/** Details an assistant draft can start a license record with. */
export interface LicenseDraft { name?: string; category?: string; issuer?: string; expiresOn?: string }

/** Turns a draft into the same shape a template has, so the form opens with it. The expiry date is left for the owner to confirm from the document. */
export function draftTemplate(d: LicenseDraft): LicenseTemplate {
  const category = (LICENSE_CATEGORIES.some((c) => c.value === d.category) ? d.category : "business") as LicenseCategory;
  return {
    id: "draft", businessType: "general", name: d.name ?? "", category, issuer: d.issuer ?? "", termMonths: 12,
    reminderDays: [60, 30, 7], documents: DEFAULT_DOCUMENTS[category], notes: "",
  };
}
