import type { Category, Priority } from "./types";

/** Word-start stems per category. A request is scored by how many different stems it contains. */
const KEYWORDS: Record<Exclude<Category, "General">, string[]> = {
  Scheduling: ["schedul", "meeting", "calendar", "appointment", "reschedul", "book", "invite", "call", "agenda"],
  Documents: ["document", "file", "contract", "form", "sign", "template", "report", "pdf", "copy", "scan", "notar"],
  "Finance & payments": ["invoice", "payment", "pay", "refund", "wire", "transfer", "expense", "reimburs", "budget", "bill", "receipt", "tax"],
  "Accounts & access": ["password", "login", "log in", "access", "account", "permission", "subscription", "user", "2fa", "locked"],
  "Vendors & purchasing": ["vendor", "supplier", "order", "purchase", "quote", "buy", "renew", "proposal"],
  "IT & equipment": ["laptop", "printer", "computer", "wifi", "wi-fi", "software", "install", "equipment", "phone", "monitor", "router"],
  "HR & people": ["hire", "hiring", "onboard", "leave", "vacation", "payroll", "employee", "benefit", "timesheet", "interview"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const startsWord = (text: string, stem: string) => new RegExp(`(^|[^a-z0-9])${escape(stem)}`, "i").test(text);

export interface Suggestion {
  category: Category;
  /** The stems that matched, for showing the user why. */
  matched: string[];
  confidence: "high" | "medium" | "low";
}

/** Rule-based categorization (no AI service): the category whose keywords appear most, or General. */
export function suggestCategory(text: string): Suggestion {
  const scored = (Object.entries(KEYWORDS) as [Exclude<Category, "General">, string[]][])
    .map(([category, stems]) => ({ category, matched: stems.filter((s) => startsWord(text, s)) }))
    .filter((c) => c.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length);
  if (scored.length === 0) return { category: "General", matched: [], confidence: "low" };
  const [top, second] = scored;
  const lead = top.matched.length - (second?.matched.length ?? 0);
  const confidence = lead > 0 && top.matched.length >= 2 ? "high" : lead > 0 ? "medium" : "low";
  return { category: top.category, matched: top.matched, confidence };
}

const HIGH = ["urgent", "asap", "immediately", "emergency", "critical", "right away", "today", "deadline"];
const LOW = ["no rush", "whenever", "when you can", "low priority", "not urgent", "at your convenience"];

export function suggestPriority(text: string): Priority {
  if (LOW.some((w) => startsWord(text, w))) return "low";
  return HIGH.some((w) => startsWord(text, w)) ? "high" : "normal";
}

/** Actions that move money, change who can get in, remove things or commit the business. */
const RISKY: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(wire|wiring)\b/i, reason: "mentions a wire transfer" },
  { pattern: /\b(transfer|send|release)\b.{0,30}\b(money|funds|payment)\b/i, reason: "moves money" },
  { pattern: /\brefunds?\b/i, reason: "mentions a refund" },
  { pattern: /\b(pay|paying|payments?)\b/i, reason: "involves a payment" },
  { pattern: /\b(delete|deleting|remove|erase|wipe)\b/i, reason: "deletes or removes something" },
  { pattern: /\b(cancel|cancelling|canceling|terminate)\b/i, reason: "cancels or terminates something" },
  { pattern: /\b(password|passwords|2fa|credentials?)\b/i, reason: "touches login credentials" },
  { pattern: /\b(grant|give|revoke)\b.{0,30}\baccess\b/i, reason: "changes who has access" },
  { pattern: /\b(sign|signing|signature)\b.{0,30}\b(contract|agreement|lease)\b|\b(contract|agreement|lease)\b.{0,30}\bsign/i, reason: "commits the business to a contract" },
  { pattern: /\b(purchase|buy|order)\b.{0,40}\$\s?\d/i, reason: "spends money" },
];

/** Why a request needs a person's approval before work starts. Empty means it can go straight ahead. */
export function approvalReasons(title: string, description: string, category: Category): string[] {
  const text = `${title}\n${description}`;
  const reasons = RISKY.filter((r) => r.pattern.test(text)).map((r) => r.reason);
  if (category === "Finance & payments" && reasons.length === 0) reasons.push("finance requests need approval");
  if (category === "Accounts & access" && reasons.length === 0) reasons.push("access changes need approval");
  return [...new Set(reasons)];
}
