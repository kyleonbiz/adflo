import { parseDate } from "@/lib/licenses/parse";

/**
 * Reads an invoice or receipt a business has been given (a bill to pay, or a purchase it made): who it is from, its number, the
 * date, when it is due, and the total. Rule based and cautious: what it cannot find is left out, nothing is guessed, and the result
 * is always shown to a person before anything is done with it.
 */
export interface Bill {
  from: string | null;
  number: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  /** The total in cents. */
  totalCents: number | null;
}

const DATE = String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4}`;
const MONEY = String.raw`\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?`;

function labelledDate(text: string, label: string): string | null {
  const re = new RegExp(`(?:${label})[^\\n\\d]{0,20}?(${DATE})`, "gi");
  for (const m of text.matchAll(re)) {
    const d = parseDate(m[1]);
    if (d) return d;
  }
  return null;
}

const toCents = (whole: string, frac: string | undefined): number | null => {
  const n = Number(whole.replace(/,/g, "")) * 100 + (frac ? Number(frac) : 0);
  return Number.isSafeInteger(n) && n > 0 && n < 1_000_000_000_00 ? n : null;
};

/** The amount after the first label that has one, trying the labels in order of how much they say "this is what is owed". */
function total(text: string): number | null {
  for (const label of [String.raw`amount\s+due|balance\s+due|total\s+due|amount\s+payable`, String.raw`grand\s+total|invoice\s+total|total\s+amount|total\s+paid|amount\s+paid`, String.raw`(?<!sub)(?<!sub-)total`]) {
    const re = new RegExp(`(?:${label})\\b[^\\n\\d$]{0,25}${MONEY}`, "gi");
    const hits = [...text.matchAll(re)].map((m) => toCents(m[1], m[2])).filter((c): c is number => c !== null);
    if (hits.length) return hits[hits.length - 1];
  }
  return null;
}

function number(text: string): string | null {
  const m = /\b(?:invoice|receipt|bill|order|confirmation)\s*(?:number|no\.?|num\.?|#)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]{1,23})\b/i.exec(text) ?? /\b(?:invoice|receipt)\s*#\s*([A-Za-z0-9][A-Za-z0-9-]{1,23})\b/i.exec(text);
  return m && /\d/.test(m[1]) ? m[1] : null;
}

/** The business it is from: after "From" or "Remit to", else the first line that reads like a name. */
function from(lines: string[]): string | null {
  for (const l of lines) {
    const m = /^(?:from|remit(?:tance)?\s+to|sold\s+by|vendor|billed\s+by|merchant)\s*[:\-]\s*(.{3,80})$/i.exec(l);
    if (m) return m[1].trim();
  }
  for (const l of lines.slice(0, 6)) {
    if (/\d{3}|invoice|receipt|statement|page|www\.|@|bill\s+to|^date\b|total|amount/i.test(l)) continue;
    if (l.length >= 3 && l.length <= 60 && /[A-Za-z]{3}/.test(l)) return l;
  }
  return null;
}

/** A bill or receipt read from text, or null when nothing useful (not even a total or a number) could be found. */
export function extractBill(text: string): Bill | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 400);
  const body = lines.join("\n");
  const bill: Bill = {
    from: from(lines),
    number: number(body),
    issuedOn: labelledDate(body, String.raw`invoice\s+date|date\s+issued|issue\s+date|date\s+of\s+(?:purchase|payment)|purchase\s+date|payment\s+date|\bdate`),
    dueOn: labelledDate(body, String.raw`due\s+date|payment\s+due|due\s+on|due\s+by|\bdue`),
    totalCents: total(body),
  };
  return bill.totalCents === null && bill.number === null ? null : bill;
}

/** A tidy file name from a bill: "Acme Supply - Invoice 1042 - 2026-11-04". Null when there is too little to say. */
export function billFileName(bill: Bill, kind: "invoice" | "receipt"): string | null {
  const parts = [bill.from, bill.number ? `${kind === "invoice" ? "Invoice" : "Receipt"} ${bill.number}` : null, bill.issuedOn].filter((p): p is string => !!p);
  if (parts.length < 2) return null;
  return parts.join(" - ").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 120);
}
