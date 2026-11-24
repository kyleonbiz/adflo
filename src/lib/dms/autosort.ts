import type { Category } from "./types";

/**
 * Works out what kind of document a file is, so an upload that was not put in a folder can be filed in the right one.
 * Rule based and deterministic: no guessing from thin evidence. A file name that points at exactly one kind is enough;
 * otherwise the text inside must clearly point at one kind (several signals, with a clear lead over the next best).
 * Anything unclear returns null and the file stays where it was put.
 */
export type SortableCategory = Exclude<Category, "other">;
export interface SortHit { category: SortableCategory; by: "name" | "content" }

const CATEGORIES: SortableCategory[] = ["insurance", "tax", "hr", "invoice", "receipt", "contract"];

/** A file name as plain lower-case words: no extension, separators and camelCase turned into spaces. */
function nameWords(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  return base.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-.+()[\]]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

const NAME_RULES: Record<SortableCategory, RegExp> = {
  insurance: /\b(insurance|coi|acord|liability|workers? ?comp(ensation)?|umbrella|binder|declarations? page)\b/,
  tax: /\b(tax(es)?|w ?9|w ?2|1099|1040|941|940|schedule c)\b/,
  hr: /\b(resumes?|cv|payroll|timesheets?|offer letter|i ?9|w ?4|handbook|employee|employment)\b/,
  invoice: /\b(invoices?|inv ?\d+)\b/,
  receipt: /\breceipts?\b/,
  contract: /\b(contracts?|agreements?|nda|leases?|sow)\b/,
};

/** The kind a file's name says it is, when it says exactly one. */
export function classifyByName(fileName: string): SortableCategory | null {
  const words = nameWords(fileName);
  if (!words) return null;
  const hits = CATEGORIES.filter((c) => NAME_RULES[c].test(words));
  return hits.length === 1 ? hits[0] : null;
}

/** Signals found in the text, each with a weight. */
const CONTENT_SIGNALS: Record<SortableCategory, [RegExp, number][]> = {
  insurance: [
    [/certificate of (liability )?insurance/, 4], [/\bacord\b/, 3], [/certificate holder/, 3], [/named insured/, 3],
    [/policy (number|no\b|period|effective|expir)/, 2], [/general liability/, 2], [/workers'? ?compensation/, 2],
    [/\bumbrella\b/, 1], [/\binsurer\b|\binsured\b/, 1], [/\bcoverages?\b/, 1],
  ],
  tax: [
    [/internal revenue service/, 4], [/\bform (w-?9|w-?2|1099|1040|941|940)\b/, 4], [/taxpayer identification/, 4],
    [/\btax year\b/, 2], [/schedule c\b/, 2], [/employer identification number/, 2], [/\bsales tax\b/, 1],
  ],
  hr: [
    [/offer (letter|of employment)/, 4], [/employment eligibility verification/, 4], [/\bform (i-?9|w-?4)\b/, 4],
    [/\b(résumé|resume|curriculum vitae)\b/, 3], [/\bpayroll\b/, 2], [/\btime ?sheet\b/, 2], [/employee handbook/, 3],
    [/\bjob (title|description)\b/, 2], [/\bemployee\b/, 1],
  ],
  invoice: [
    [/invoice (number|no\b|#|date)/, 4], [/(amount|balance|total) due/, 3], [/\bbill to\b/, 2], [/remit(tance)? to/, 2],
    [/\bdue date\b/, 1], [/\binvoice\b/, 1],
  ],
  receipt: [
    [/thank you for your (purchase|payment|business)/, 4], [/payment received/, 3], [/\breceipt\b/, 3],
    [/paid in full/, 2], [/(visa|mastercard|amex|card) (ending|\*+)/, 2], [/\bauth(orization)? code\b/, 1],
  ],
  contract: [
    [/this agreement/, 3], [/\bhereinafter\b|\bwhereas\b/, 3], [/scope of work/, 3], [/governing law/, 3],
    [/terms and conditions/, 2], [/\bindemnif/, 2], [/\bparties\b|\bparty\b/, 1], [/\btermination\b/, 1], [/\bsignature\b/, 1],
  ],
};

/** Only the start of a long document is read: the kind of document is always evident there. */
const READ_CHARS = 8000;
/** A kind needs this much evidence, and this much more than the next best, to be chosen. */
const MIN_SCORE = 5;
const MIN_LEAD = 2;

/** The kind the text clearly says it is, or null when it is not clear. */
export function classifyByContent(text: string): SortableCategory | null {
  const t = text.slice(0, READ_CHARS).toLowerCase();
  if (t.trim().length < 40) return null;
  const scores = CATEGORIES.map((c) => ({ c, s: CONTENT_SIGNALS[c].reduce((sum, [re, w]) => sum + (re.test(t) ? w : 0), 0) })).sort((a, b) => b.s - a.s);
  const [best, next] = scores;
  return best.s >= MIN_SCORE && best.s - next.s >= MIN_LEAD ? best.c : null;
}

/** Name first (cheap and decisive), then the text inside. */
export function classifyDocument(fileName: string, text?: string | null): SortHit | null {
  const byName = classifyByName(fileName);
  if (byName) return { category: byName, by: "name" };
  const byContent = text ? classifyByContent(text) : null;
  return byContent ? { category: byContent, by: "content" } : null;
}
