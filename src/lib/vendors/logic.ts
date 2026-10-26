import { toCsv } from "@/lib/csv";
import { daysBetween, formatDayLong } from "@/lib/dates";
import type { DocState, Vendor, VendorAlert, VendorCategory, VendorDocument } from "./types";

/** A document within this many days of expiry is "expiring". */
export const EXPIRING_DAYS = 30;
export const VENDOR_APPROVER = "Operations manager";

/** What a new vendor must provide, by category. Every vendor needs a W-9 and insurance. */
export function defaultRequirements(category: VendorCategory): { type: string; expires: boolean }[] {
  const base = [{ type: "W-9", expires: false }, { type: "Certificate of insurance", expires: true }];
  switch (category) {
    case "Software": return [...base, { type: "Master services agreement", expires: false }, { type: "Security questionnaire", expires: true }];
    case "Professional services": return [...base, { type: "Signed contract", expires: false }, { type: "Business license", expires: true }];
    case "Logistics": return [...base, { type: "Signed contract", expires: false }, { type: "Carrier permit", expires: true }];
    default: return base;
  }
}

export function docState(d: VendorDocument, today: string): DocState {
  if (!d.receivedOn) return "missing";
  if (!d.expiresOn) return "valid";
  const left = daysBetween(today, d.expiresOn);
  if (left < 0) return "expired";
  return left <= EXPIRING_DAYS ? "expiring" : "valid";
}

const satisfied = (d: VendorDocument, today: string) => ["valid", "expiring"].includes(docState(d, today));

/** Required documents that are received and not expired, out of all required ones. */
export function onboardingProgress(v: Vendor, today: string): { done: number; total: number } {
  const required = v.documents.filter((d) => d.required);
  return { done: required.filter((d) => satisfied(d, today)).length, total: required.length };
}

export function approvalBlockers(v: Vendor, today: string): string[] {
  return v.documents
    .filter((d) => d.required && !satisfied(d, today))
    .map((d) => (docState(d, today) === "expired" ? `${d.type} has expired` : `${d.type} is missing`));
}

/** Moves an onboarding vendor to approval, but only when every required document is in. */
export function submitForApproval(v: Vendor, today: string): Vendor {
  if (v.status !== "onboarding" || approvalBlockers(v, today).length > 0) return v;
  return { ...v, status: "pending_approval", decidedBy: null, decidedOn: null, comment: "" };
}

/** Approve or reject a vendor awaiting approval. Anything else is returned unchanged. */
export function decide(v: Vendor, decision: "approved" | "rejected", by: string, today: string, comment = ""): Vendor {
  if (v.status !== "pending_approval") return v;
  return { ...v, status: decision, decidedBy: by, decidedOn: today, comment: comment.trim() };
}

/** A rejected vendor goes back to onboarding to fix problems and resubmit. */
export function reopen(v: Vendor): Vendor {
  return v.status === "rejected" ? { ...v, status: "onboarding" } : v;
}

/** Approved vendors can be switched off and on; others are unchanged. */
export function setActive(v: Vendor, active: boolean): Vendor {
  if (active && v.status === "inactive") return { ...v, status: "approved" };
  if (!active && v.status === "approved") return { ...v, status: "inactive" };
  return v;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Alerts that apply today, most severe first. Inactive and rejected vendors raise none. */
export function vendorAlerts(v: Vendor, today: string): VendorAlert[] {
  if (v.status === "inactive" || v.status === "rejected") return [];
  const alerts: VendorAlert[] = [];
  let outstanding = 0;
  for (const d of v.documents) {
    const state = docState(d, today);
    if (state === "expired") {
      alerts.push({ severity: d.required ? "critical" : "warning", message: `${d.type} expired ${formatDayLong(d.expiresOn!)}.` });
    } else if (state === "expiring") {
      const left = daysBetween(today, d.expiresOn!);
      alerts.push({ severity: d.required ? "warning" : "info", message: `${d.type} expires in ${plural(left, "day")}.` });
    } else if (state === "missing" && d.required) {
      outstanding++;
    }
  }
  if (outstanding > 0 && v.status === "onboarding") alerts.push({ severity: "info", message: `${plural(outstanding, "required document")} outstanding.` });
  if (v.status === "pending_approval") alerts.push({ severity: "info", message: "Awaiting approval." });
  const order = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

// --- Duplicate detection -------------------------------------------------

const SUFFIXES = new Set(["inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "co", "company", "llp", "lp", "plc"]);
const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "live.com", "msn.com"]);

/** "The Acme Co., Inc." -> "acme". Lowercase, no punctuation, no legal suffixes or leading "the". */
export function normalizeName(name: string): string {
  const words = name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  if (words.length > 1 && words[0] === "the") words.shift();
  return words.join(" ");
}

export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const domain = (email: string) => email.toLowerCase().split("@")[1] ?? "";

export interface Candidate { name: string; email: string; taxId: string }

/** Why two vendor records may be the same company. Empty when nothing matches. */
export function duplicateReasons(a: Candidate, b: Candidate): string[] {
  const reasons: string[] = [];
  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  if (na && na === nb) reasons.push("Same name");
  else if (na.length >= 8 && nb.length >= 8 && editDistance(na, nb) / Math.max(na.length, nb.length) <= 0.2) reasons.push("Similar name");
  if (a.taxId && a.taxId === b.taxId) reasons.push("Same tax ID");
  if (a.email && a.email.toLowerCase() === b.email.toLowerCase()) reasons.push("Same contact email");
  else if (domain(a.email) && domain(a.email) === domain(b.email) && !FREE_MAIL.has(domain(a.email))) reasons.push("Same email domain");
  return reasons;
}

export function findDuplicates(vendors: Vendor[], candidate: Candidate, ignoreId?: string): { vendor: Vendor; reasons: string[] }[] {
  return vendors
    .filter((v) => v.id !== ignoreId)
    .map((vendor) => ({ vendor, reasons: duplicateReasons(candidate, vendor) }))
    .filter((m) => m.reasons.length > 0);
}

export interface DuplicatePair { a: Vendor; b: Vendor; reasons: string[] }

export function duplicatePairs(vendors: Vendor[]): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  for (let i = 0; i < vendors.length; i++) {
    for (let j = i + 1; j < vendors.length; j++) {
      const reasons = duplicateReasons(vendors[i], vendors[j]);
      if (reasons.length > 0) out.push({ a: vendors[i], b: vendors[j], reasons });
    }
  }
  return out;
}

// --- Summary and export --------------------------------------------------

export interface VendorSummary {
  vendors: number;
  approved: number;
  pendingApproval: number;
  documentIssues: number;
  duplicatePairs: number;
}

export function summarize(vendors: Vendor[], today: string): VendorSummary {
  const live = vendors.filter((v) => v.status !== "inactive" && v.status !== "rejected");
  return {
    vendors: vendors.length,
    approved: vendors.filter((v) => v.status === "approved").length,
    pendingApproval: vendors.filter((v) => v.status === "pending_approval").length,
    documentIssues: live.reduce((n, v) => n + v.documents.filter((d) => ["expiring", "expired"].includes(docState(d, today))).length, 0),
    duplicatePairs: duplicatePairs(vendors).length,
  };
}

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

/** Vendors with a critical or warning alert, most severe first. */
export function needsAttention(vendors: Vendor[], today: string): { vendor: Vendor; alert: VendorAlert }[] {
  return vendors
    .flatMap((vendor) => {
      const alert = vendorAlerts(vendor, today).find((a) => a.severity !== "info");
      return alert ? [{ vendor, alert }] : [];
    })
    .sort((x, y) => SEVERITY_RANK[x.alert.severity] - SEVERITY_RANK[y.alert.severity] || x.vendor.name.localeCompare(y.vendor.name));
}

export function vendorsToCsv(vendors: Vendor[], today: string): string {
  return toCsv([
    ["Name", "Category", "Status", "Contact", "Email", "Phone", "Tax ID", "Required docs in", "Required docs total", "Document issues"],
    ...vendors.map((v) => {
      const p = onboardingProgress(v, today);
      const issues = v.documents.filter((d) => ["expiring", "expired"].includes(docState(d, today))).map((d) => `${d.type} (${docState(d, today)})`);
      return [v.name, v.category, v.status, v.contactName, v.email, v.phone, v.taxId, p.done, p.total, issues.join("; ")];
    }),
  ]);
}
