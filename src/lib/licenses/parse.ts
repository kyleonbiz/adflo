import { addMonths, isDay } from "@/lib/dates";
import type { LicenseCategory } from "./types";

/** What could be read from an uploaded license, certificate or policy. Only fields that were found are present. */
export interface ExtractedLicense {
  name?: string;
  category?: LicenseCategory;
  issuer?: string;
  number?: string;
  holder?: string;
  issuedOn?: string;
  expiresOn?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DATE = String.raw`\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4}`;

function day(y: number, m: number, d: number): string | null {
  const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isDay(s) ? s : null;
}

/** Reads one date in ISO, US numeric (M/D/YYYY), or written-out form. Returns null when it is not a real day. */
export function parseDate(text: string): string | null {
  const t = text.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return day(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    // US order unless the first number can only be a day.
    return +m[1] > 12 ? day(year, +m[2], +m[1]) : day(year, +m[1], +m[2]);
  }
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(t);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return day(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(t);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return day(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  return null;
}

const EXPIRES = String.raw`(?:expiration|expiry|expires?|expiring|valid\s+(?:through|thru|until|to)|renewal\s+due|renew\s+by|policy\s+(?:period\s+)?end|end\s+date)`;
const ISSUED = String.raw`(?:date\s+issued|issued(?:\s+on|\s+date)?|issue\s+date|effective(?:\s+date)?|valid\s+from|start\s+date|original\s+issue(?:\s+date)?)`;

function labeledDate(text: string, label: string): string | null {
  const re = new RegExp(`${label}(?:\\s+date)?[^\\n\\d]{0,25}?(${DATE})`, "gi");
  for (const m of text.matchAll(re)) {
    const d = parseDate(m[1]);
    if (d) return d;
  }
  return null;
}

function labeledText(text: string, label: string, min = 2, max = 100): string | undefined {
  const m = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n]{${min},${max}})`, "i").exec(text);
  const v = m?.[1].trim().replace(/\s{2,}/g, " ");
  return v || undefined;
}

function findNumber(text: string): string | undefined {
  const re = /(?:licen[sc]e|permit|policy|certificate|registration|commission|account|file|reg\.?)\s*(?:no\.?|number|num\.?|#|id)\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\-/.]{2,30})/gi;
  for (const m of text.matchAll(re)) {
    const v = m[1].replace(/[.\-/]+$/, "");
    if (/\d/.test(v)) return v;
  }
  return undefined;
}

const CATEGORY_HINTS: [RegExp, LicenseCategory][] = [
  [/insurance|policy\s+(?:no|number)|certificate\s+of\s+(?:liability\s+)?insurance|coverage/i, "insurance"],
  [/permit/i, "permit"],
  [/registration|registered|tax\s+id|sales\s+tax/i, "registration"],
  [/notary|commission|certified|professional|board\s+of|bar\s+association|certificate\s+of\s+competency/i, "professional"],
  [/business\s+licen[sc]e|licen[sc]e/i, "business"],
];

/** A short top-of-page line that names the document, e.g. "State Business License". */
function findName(text: string): string | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12);
  return lines.find((l) => l.length >= 4 && l.length <= 80 && !/[:#]\s*\S/.test(l) && /licen[sc]e|permit|certificate|registration|insurance|commission|policy/i.test(l));
}

/**
 * Best-effort reading of a license, permit, certificate or policy from its text. It only reports what
 * it finds next to a recognizable label, so a missing field is left for the user to fill in rather than guessed.
 */
export function parseLicenseText(text: string): ExtractedLicense {
  const out: ExtractedLicense = {};
  const name = findName(text);
  if (name) out.name = name;
  const hint = CATEGORY_HINTS.find(([re]) => re.test(name ?? text.slice(0, 600)));
  if (hint) out.category = hint[1];
  const issuer = labeledText(text, String.raw`(?:issued\s+by|issuing\s+(?:authority|agency|office)|issuer|authority|agency)`)
    ?? labeledText(text, String.raw`(?:insurer|carrier|insurance\s+company)`);
  if (issuer) out.issuer = issuer;
  const number = findNumber(text);
  if (number) out.number = number;
  const holder = labeledText(text, String.raw`(?:issued\s+to|licensee|licen[sc]e\s+holder|holder|insured|registered\s+to|business\s+name|name\s+of\s+(?:licensee|holder|business))`);
  if (holder) out.holder = holder;
  const expiresOn = labeledDate(text, EXPIRES);
  if (expiresOn) out.expiresOn = expiresOn;
  const issuedOn = labeledDate(text, ISSUED);
  if (issuedOn && (!expiresOn || issuedOn < expiresOn)) out.issuedOn = issuedOn;
  return out;
}

/** Number of fields found, for deciding whether the file looked like a license at all. */
export const foundCount = (e: ExtractedLicense) => Object.keys(e).length;

/** Fills in an issue date when only the expiry was found, so the pair is consistent: one term before expiry. */
export function withIssueDate(e: ExtractedLicense, termMonths = 12): ExtractedLicense {
  return e.expiresOn && !e.issuedOn ? { ...e, issuedOn: addMonths(e.expiresOn, -termMonths) } : e;
}
