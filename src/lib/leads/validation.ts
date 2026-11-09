export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export interface DemoRequest {
  name: string;
  email: string;
  company: string;
  size: CompanySize;
  message: string;
}

export type DemoRequestField = keyof DemoRequest;
export type ParsedDemoRequest =
  | { ok: true; value: DemoRequest }
  | { ok: false; errors: Partial<Record<DemoRequestField, string>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const clean = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL, "").trim() : "");

/** Checks the demo request form. The database function repeats these rules, so a direct call cannot skip them. */
export function parseDemoRequest(raw: unknown): ParsedDemoRequest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Partial<Record<DemoRequestField, string>> = {};
  const name = clean(r.name);
  const email = clean(r.email).toLowerCase();
  const company = clean(r.company);
  const size = clean(r.size);
  const message = clean(r.message);
  if (name.length < 2 || name.length > 120) errors.name = "Enter your full name.";
  if (!EMAIL.test(email) || email.length > 254) errors.email = "Enter a valid business email.";
  if (company.length < 1 || company.length > 160) errors.company = "Enter your company name.";
  if (!(COMPANY_SIZES as readonly string[]).includes(size)) errors.size = "Choose your company size.";
  if (message.length > 2000) errors.message = "Keep the message under 2,000 characters.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email, company, size: size as CompanySize, message } };
}
