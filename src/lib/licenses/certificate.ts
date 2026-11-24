import { DEFAULT_DOCUMENTS, type License } from "./types";
import { parseDate } from "./parse";

/**
 * Reads a certificate of insurance (the standard ACORD 25 form, or a plain certificate) from its text: who is insured, who the
 * certificate is for, and each policy with its insurer, number and dates. Rule based and cautious. What it cannot find is left
 * out, and the result is always shown to a person to confirm before anything is saved.
 */
export interface CertificatePolicy {
  /** What it covers, e.g. "General liability". */
  kind: string;
  insurer: string | null;
  policyNumber: string | null;
  effectiveOn: string | null;
  expiresOn: string;
}

export interface Certificate {
  insured: string | null;
  holder: string | null;
  producer: string | null;
  policies: CertificatePolicy[];
}

/** Coverage headings and what they are called here, most specific first. */
const COVERAGES: [RegExp, string][] = [
  [/umbrella|excess\s+liab/i, "Umbrella / excess liability"],
  [/workers['’]?\s*comp/i, "Workers' compensation"],
  [/professional\s+liab|errors\s+(?:&|and)\s+omissions|\be&o\b/i, "Professional liability"],
  [/automobile\s+liab|auto\s+liab|business\s+auto|hired\s+(?:and|&)\s+non-?owned/i, "Auto liability"],
  [/commercial\s+general\s+liab|general\s+liab|\bcgl\b/i, "General liability"],
  [/builders?['’]?\s*risk|installation\s+floater|inland\s+marine|contractors?['’]?\s*equipment/i, "Property / equipment"],
  [/pollution\s+liab/i, "Pollution liability"],
];

const DATE = String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}`;
const DATE_RE = new RegExp(DATE, "g");
/** Letters, digits and dashes, with at least one digit: a policy number, not a word. */
const POLICY_TOKEN = /(?<![A-Za-z0-9/-])(?=[A-Za-z0-9/-]*\d)[A-Za-z0-9][A-Za-z0-9/-]{4,23}(?![A-Za-z0-9/-])/g;
const LABELS = /^(?:insured|named insured|producer|insurer|insurers?\s+affording|certificate holder|coverages?|contact|phone|fax|e-?mail|address|naic|description|cancellation|authorized|name:|policy|date)\b/i;

function dateOf(s: string): string | null {
  return parseDate(s);
}

function isDateLike(token: string): boolean {
  return new RegExp(`^(?:${DATE})$`).test(token) || /^\d{1,2}[/-]\d{1,2}$/.test(token);
}

function looksLikePolicyNumber(token: string): boolean {
  if (isDateLike(token)) return false;
  if (/^\d{5}$/.test(token)) return false; // a NAIC code
  if (/^\d{1,4}$/.test(token)) return false;
  if (/^(?:19|20)\d{2}$/.test(token)) return false;
  if (/^(?:acord|iso|ca|cg)\d*$/i.test(token)) return false;
  return true;
}

/** The text of a labelled field: on the same line after a colon, or the next real line. */
function field(lines: string[], label: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const m = label.exec(lines[i]);
    if (!m) continue;
    const rest = lines[i].slice(m.index + m[0].length).replace(/^[\s:.\-–]+/, "").trim();
    if (rest.length >= 3 && !LABELS.test(rest)) return clean(rest);
    for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
      const next = lines[j].trim();
      if (next.length >= 3 && !LABELS.test(next) && !/^\d[\d\s/.-]*$/.test(next)) return clean(next);
    }
  }
  return null;
}

/** A name without trailing form fields, phone numbers or extra columns of the form. */
function clean(s: string): string {
  return s.replace(/\s{2,}.*$/, "").replace(/\s*\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}.*$/, "").replace(/[,;:\s]+$/, "").trim().slice(0, 100);
}

/** A policy number written after its label, on the same line or the next one; it may contain single spaces ("84 SBA 1234"). */
function labelledPolicyNumber(window: string[]): string | null {
  for (let i = 0; i < window.length; i++) {
    const m = /policy\s*(?:number|no\.?|#)\s*[:\-]?\s*(.*)$/i.exec(window[i]);
    if (!m) continue;
    const candidate = (m[1].trim() || window[i + 1]?.trim() || "").split(/\s{2,}/)[0].trim();
    const value = candidate.replace(/\s+\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}.*$/, "").trim();
    if (value.length >= 4 && value.length <= 24 && /\d/.test(value) && /^[A-Za-z0-9][A-Za-z0-9/ -]*$/.test(value) && !isDateLike(value) && looksLikePolicyNumber(value.replace(/\s+/g, ""))) return value;
  }
  return null;
}

export function extractCertificate(text: string): Certificate | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\t/g, "  ").trimEnd()).filter((l) => l.trim());
  if (lines.length < 3) return null;
  const whole = lines.join("\n");
  if (!/certificate\s+of\s+(?:liability\s+)?insurance|\bacord\b|policy\s+(?:number|no\b|period)|\bcoverages?\b/i.test(whole)) return null;

  // "INSURER A : Travelers Indemnity Co" lines, so a coverage row's letter can be turned into a name.
  const insurers = new Map<string, string>();
  for (const l of lines) {
    const m = /insurer\s*([A-F])\s*[:\-]\s*([^\d\n]{3,60}?)(?:\s{2,}|\s+\d{4,6}\b|$)/i.exec(l);
    if (m && !insurers.has(m[1].toUpperCase())) insurers.set(m[1].toUpperCase(), clean(m[2]));
  }
  const onlyInsurer = insurers.size === 1 ? [...insurers.values()][0] : null;

  const policies: CertificatePolicy[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const cov = COVERAGES.find(([re]) => re.test(lines[i]));
    if (!cov || seen.has(cov[1])) continue;
    const window = lines.slice(i, i + 5);
    const joined = window.join("\n");
    const dates = [...joined.matchAll(DATE_RE)].map((m) => dateOf(m[0])).filter((d): d is string => !!d).sort();
    if (dates.length === 0) continue;
    const expiresOn = dates[dates.length - 1];
    const effectiveOn = dates.length > 1 && dates[0] !== expiresOn ? dates[0] : null;
    const fromTokens = [...joined.matchAll(POLICY_TOKEN)].map((m) => m[0]).find((t) => looksLikePolicyNumber(t) && !/^[A-Za-z]+$/.test(t));
    const policyNumber = labelledPolicyNumber(window) ?? fromTokens ?? null;
    const letter = /^\s*([A-F])\b/.exec(lines[i])?.[1]?.toUpperCase();
    const insurer = (letter && insurers.get(letter)) || onlyInsurer;
    seen.add(cov[1]);
    policies.push({ kind: cov[1], insurer: insurer ?? null, policyNumber, effectiveOn, expiresOn });
  }

  // A plain certificate with one policy and no coverage headings: "Policy Number: X", "Policy Period: 11/01/2026 to 11/01/2027".
  if (policies.length === 0) {
    const period = new RegExp(`policy\\s+period[^\\d\\n]{0,15}(${DATE})\\s*(?:to|-|through|thru|–)\\s*(${DATE})`, "i").exec(whole);
    const number = /policy\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9/-]{3,23})/i.exec(whole)?.[1] ?? null;
    const from = period ? dateOf(period[1]) : null;
    const to = period ? dateOf(period[2]) : null;
    if (to) policies.push({ kind: "Insurance policy", insurer: field(lines, /insurer|insurance\s+company|carrier/i) ?? onlyInsurer, policyNumber: number, effectiveOn: from, expiresOn: to });
  }
  if (policies.length === 0) return null;

  return {
    insured: field(lines, /^\s*(?:named\s+)?insured\b(?!\s+(?:for|by))/i),
    holder: field(lines, /^\s*certificate\s+holder/i),
    producer: field(lines, /^\s*producer/i),
    policies,
  };
}

/** The earliest expiry among the policies: when this certificate stops being good. */
export function certificateExpiry(c: Certificate): string {
  return c.policies.map((p) => p.expiresOn).sort()[0];
}

const insuranceName = (kind: string) => (kind === "Insurance policy" ? "Insurance policy" : `${kind} insurance`);

/** One tracked record per policy, ready to add to Licenses & Renewals. They start unverified, so each is flagged for a quick review. */
export function certificateToLicenses(c: Certificate, opts: { newId: () => string; documentName: string }): License[] {
  return c.policies.map((p) => ({
    id: opts.newId(),
    name: insuranceName(p.kind),
    category: "insurance" as const,
    issuer: p.insurer ?? "",
    number: p.policyNumber ?? "",
    holder: c.insured ?? "",
    issuedOn: p.effectiveOn ?? "",
    expiresOn: p.expiresOn,
    renewalTermMonths: 12,
    reminderDays: [60, 30, 7],
    stage: "not_started" as const,
    requiredDocuments: DEFAULT_DOCUMENTS.insurance.map((label, i) => ({ id: `${opts.newId()}-${i}`, label, received: false })),
    notes: `Read from the certificate "${opts.documentName}". Check the details against the certificate.`,
  }));
}

/** A policy is already tracked when a license has its number and expiry (or the same name and expiry when there is no number). */
export function alreadyTracked(p: CertificatePolicy, licenses: Pick<License, "name" | "number" | "expiresOn" | "category">[]): boolean {
  return licenses.some((l) => l.category === "insurance" && l.expiresOn === p.expiresOn && (p.policyNumber ? l.number.replace(/\W/g, "").toLowerCase() === p.policyNumber.replace(/\W/g, "").toLowerCase() : l.name.toLowerCase().includes(p.kind.toLowerCase().split(" ")[0])));
}

/** Days from `today` to the earliest expiry (negative when it has lapsed). */
export function daysUntilExpiry(c: Certificate, today: string): number {
  const end = Date.parse(`${certificateExpiry(c)}T00:00:00Z`);
  return Math.round((end - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
