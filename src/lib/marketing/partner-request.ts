export const PARTNER_TYPES = [
  "Contractor association or trade group",
  "Trade school or educator",
  "Insurance agency",
  "Business consultant or bookkeeping firm",
  "Supplier serving contractors",
  "Small-business support organization",
  "Other",
] as const;

type PartnerRequest = { name: string; email: string; organization: string; type: string; message: string };
type PartnerParse = { ok: true; value: PartnerRequest } | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");

/** Checks what the /partners form sent. Single-line fields cannot carry line breaks (no header tricks). */
export function parsePartnerRequest(raw: unknown): PartnerParse {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const oneLine = (v: unknown, max: number) => clean(v, max).replace(/[\r\n]+/g, " ");
  const value: PartnerRequest = {
    name: oneLine(r.name, 120),
    email: oneLine(r.email, 200),
    organization: oneLine(r.organization, 160),
    type: oneLine(r.type, 80),
    message: clean(r.message, 2000),
  };
  const errors: Record<string, string> = {};
  if (!value.name) errors.name = "Enter your name.";
  if (!EMAIL.test(value.email)) errors.email = "Enter a valid email address.";
  if (!value.organization) errors.organization = "Enter your organization.";
  if (!(PARTNER_TYPES as readonly string[]).includes(value.type)) errors.type = "Choose what best describes you.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export function partnerRequestText(d: PartnerRequest): string {
  return [`Name: ${d.name}`, `Email: ${d.email}`, `Organization: ${d.organization}`, `Type: ${d.type}`, "", d.message || "(no message)"].join("\n");
}
