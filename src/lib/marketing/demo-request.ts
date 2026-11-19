export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"] as const;

type DemoRequest = { name: string; email: string; company: string; size: string; message: string };
type DemoParse = { ok: true; value: DemoRequest } | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");

/** Checks what the landing page form sent. Single-line fields cannot carry line breaks (no header tricks). */
export function parseDemoRequest(raw: unknown): DemoParse {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const oneLine = (v: unknown, max: number) => clean(v, max).replace(/[\r\n]+/g, " ");
  const value: DemoRequest = {
    name: oneLine(r.name, 120),
    email: oneLine(r.email, 200),
    company: oneLine(r.company, 160),
    size: oneLine(r.size, 20),
    message: clean(r.message, 2000),
  };
  const errors: Record<string, string> = {};
  if (!value.name) errors.name = "Enter your name.";
  if (!EMAIL.test(value.email)) errors.email = "Enter a valid email address.";
  if (!value.company) errors.company = "Enter your company name.";
  if (!(COMPANY_SIZES as readonly string[]).includes(value.size)) errors.size = "Choose a company size.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export function demoRequestText(d: DemoRequest): string {
  return [`Name: ${d.name}`, `Business email: ${d.email}`, `Company: ${d.company}`, `Company size: ${d.size}`, "", d.message || "(no message)"].join("\n");
}
